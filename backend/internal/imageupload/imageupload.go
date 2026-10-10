// Package imageupload validates and normalises user-uploaded images before
// they reach object storage.
//
// Nothing the client says about the file is trusted — not its Content-Type,
// not its filename. The bytes are sniffed, their dimensions are read before
// any pixel is decoded (decompression bombs), and the image is then decoded
// and encoded again from scratch. The re-encode is what makes the stored
// object safe to serve: EXIF (GPS) and any trailing or embedded payload
// (polyglot files) do not survive it, and the format and extension are
// chosen here, never by the uploader.
//
// SVG is deliberately unsupported: it is markup, so it can carry script, and
// the app renders icons offline from a local image cache.
package imageupload

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"net/http"

	xdraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp" // registers the WebP decoder with image.Decode
)

const (
	// ContentTypePNG and ContentTypeJPEG are the only types ever produced.
	ContentTypePNG  = "image/png"
	ContentTypeJPEG = "image/jpeg"

	// MaxPixels caps width*height read from the header, before decoding: a
	// few-KB PNG can declare billions of pixels.
	MaxPixels = 4096 * 4096
	// MaxDecodedBytes caps the memory the decoded bitmap will take, which is
	// MaxPixels times the bytes one pixel needs: a 16-bit PNG needs twice what
	// an 8-bit one does. 64 MiB is exactly a 4096x4096 8-bit RGBA image.
	MaxDecodedBytes = 64 << 20
	// maxConcurrentDecodes bounds how many images are decoded at the same
	// time, process-wide. The API container is capped at a few hundred MB, so
	// concurrent worst-case decodes would add up to an out-of-memory kill.
	maxConcurrentDecodes = 2
	// MaxEdge is the longest side of a stored image. Icons and avatars are
	// shown at well under this; larger inputs are scaled down.
	MaxEdge = 512

	jpegQuality = 85
	sniffBytes  = 512
)

// decodeSlots is the semaphore behind maxConcurrentDecodes. onDecodeStart is
// a test hook, called once a slot is held.
var (
	decodeSlots   = make(chan struct{}, maxConcurrentDecodes)
	onDecodeStart func()
)

var (
	ErrTooLarge        = errors.New("imageupload: file is too large")
	ErrUnsupportedType = errors.New("imageupload: not a PNG, JPEG or WebP image")
	ErrDimensions      = errors.New("imageupload: image dimensions are too large")
	ErrUnreadable      = errors.New("imageupload: image could not be decoded")
)

// Image is a validated, freshly encoded image, ready to store.
type Image struct {
	Data        []byte
	ContentType string
}

// Process validates data (at most maxBytes) and returns it re-encoded as PNG
// or JPEG, scaled to MaxEdge and with its EXIF orientation applied.
func Process(data []byte, maxBytes int) (*Image, error) {
	if len(data) > maxBytes {
		return nil, ErrTooLarge
	}

	sniffed := http.DetectContentType(data[:min(len(data), sniffBytes)])
	if sniffed != "image/png" && sniffed != "image/jpeg" && sniffed != "image/webp" {
		return nil, ErrUnsupportedType
	}

	// Header only: reject oversized dimensions before allocating the bitmap.
	cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return nil, ErrUnreadable
	}
	if format != "png" && format != "jpeg" && format != "webp" {
		return nil, ErrUnsupportedType
	}
	if cfg.Width <= 0 || cfg.Height <= 0 || cfg.Width*cfg.Height > MaxPixels ||
		cfg.Width*cfg.Height*bytesPerPixel(cfg.ColorModel) > MaxDecodedBytes {
		return nil, ErrDimensions
	}

	decodeSlots <- struct{}{}
	defer func() { <-decodeSlots }()
	if onDecodeStart != nil {
		onDecodeStart()
	}

	decoded, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, ErrUnreadable
	}

	// Orientation lives in EXIF, which the re-encode drops: apply it first or
	// a phone photo would come out sideways.
	orientation := 1
	if format == "jpeg" {
		orientation = jpegOrientation(data)
	}
	out := orient(scaleDown(decoded, MaxEdge), orientation)

	encoded, contentType, err := encode(out, format)
	if err != nil {
		return nil, ErrUnreadable
	}
	return &Image{Data: encoded, ContentType: contentType}, nil
}

// encode keeps PNG as PNG and JPEG as JPEG. WebP becomes PNG when it has
// transparency and JPEG when it does not.
func encode(img image.Image, sourceFormat string) ([]byte, string, error) {
	asJPEG := sourceFormat == "jpeg" || (sourceFormat == "webp" && isOpaque(img))

	var buf bytes.Buffer
	if asJPEG {
		if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: jpegQuality}); err != nil {
			return nil, "", err
		}
		return buf.Bytes(), ContentTypeJPEG, nil
	}
	if err := png.Encode(&buf, img); err != nil {
		return nil, "", err
	}
	return buf.Bytes(), ContentTypePNG, nil
}

func isOpaque(img image.Image) bool {
	if o, ok := img.(interface{ Opaque() bool }); ok {
		return o.Opaque()
	}
	return false
}

// scaleDown shrinks img so its longest side is at most maxEdge, keeping the
// aspect ratio. Smaller images are only copied into an NRGBA bitmap.
func scaleDown(src image.Image, maxEdge int) *image.NRGBA {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	if longest := max(w, h); longest > maxEdge {
		w = max(1, w*maxEdge/longest)
		h = max(1, h*maxEdge/longest)
	}
	dst := image.NewNRGBA(image.Rect(0, 0, w, h))
	xdraw.CatmullRom.Scale(dst, dst.Bounds(), src, b, xdraw.Src, nil)
	return dst
}

// orient applies an EXIF orientation value (1-8) and returns the upright
// image. Orientation 1, or any value outside 1-8, returns img unchanged.
func orient(img *image.NRGBA, orientation int) *image.NRGBA {
	if orientation < 2 || orientation > 8 {
		return img
	}
	w, h := img.Bounds().Dx(), img.Bounds().Dy()
	outW, outH := w, h
	if orientation >= 5 {
		outW, outH = h, w
	}

	dst := image.NewNRGBA(image.Rect(0, 0, outW, outH))
	for y := 0; y < outH; y++ {
		for x := 0; x < outW; x++ {
			sx, sy := sourcePixel(orientation, x, y, w, h)
			dst.SetNRGBA(x, y, img.NRGBAAt(sx, sy))
		}
	}
	return dst
}

// sourcePixel maps an output pixel back to the source pixel it comes from,
// for a source of w x h pixels.
func sourcePixel(orientation, x, y, w, h int) (int, int) {
	switch orientation {
	case 2: // mirror horizontally
		return w - 1 - x, y
	case 3: // rotate 180
		return w - 1 - x, h - 1 - y
	case 4: // mirror vertically
		return x, h - 1 - y
	case 5: // transpose
		return y, x
	case 6: // rotate 90 clockwise
		return y, h - 1 - x
	case 7: // transverse
		return w - 1 - y, h - 1 - x
	default: // 8: rotate 90 counter-clockwise
		return w - 1 - y, x
	}
}

// bytesPerPixel is what the decoder allocates per pixel for a colour model,
// rounded up where unsure: 16-bit models take twice the bytes of 8-bit ones,
// and anything unrecognised is assumed to be the largest common 8-bit layout.
func bytesPerPixel(model color.Model) int {
	switch model {
	case color.GrayModel:
		return 1
	case color.Gray16Model, color.YCbCrModel:
		return 2
	case color.RGBA64Model, color.NRGBA64Model:
		return 8
	}
	if _, ok := model.(color.Palette); ok {
		return 1
	}
	return 4
}
