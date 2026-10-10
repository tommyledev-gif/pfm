package imageupload

import (
	"bytes"
	"encoding/base64"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

const testMaxBytes = 2 * 1024 * 1024

func solid(w, h int, c color.NRGBA) *image.NRGBA {
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.SetNRGBA(x, y, c)
		}
	}
	return img
}

func encodePNG(t *testing.T, img image.Image) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func encodeJPEG(t *testing.T, img image.Image) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 95}); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func decode(t *testing.T, data []byte) (image.Image, string) {
	t.Helper()
	img, format, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("output does not decode: %v", err)
	}
	return img, format
}

// withEXIFOrientation inserts an APP1/Exif segment carrying the given
// orientation right after the JPEG's SOI marker.
func withEXIFOrientation(jpegBytes []byte, orientation byte) []byte {
	tiff := []byte{
		'I', 'I', 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, // header, IFD0 at 8
		0x01, 0x00, // one entry
		0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orientation, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, // no next IFD
	}
	payload := append([]byte("Exif\x00\x00"), tiff...)
	segLen := len(payload) + 2
	segment := append([]byte{0xFF, 0xE1, byte(segLen >> 8), byte(segLen)}, payload...)

	out := append([]byte{}, jpegBytes[:2]...)
	out = append(out, segment...)
	return append(out, jpegBytes[2:]...)
}

func TestProcessKeepsPNGAsPNG(t *testing.T) {
	out, err := Process(encodePNG(t, solid(64, 64, color.NRGBA{R: 200, A: 255})), testMaxBytes)
	if err != nil {
		t.Fatal(err)
	}
	if out.ContentType != ContentTypePNG {
		t.Fatalf("content type = %s, want %s", out.ContentType, ContentTypePNG)
	}
	if _, format := decode(t, out.Data); format != "png" {
		t.Fatalf("stored format = %s, want png", format)
	}
}

func TestProcessKeepsJPEGAsJPEG(t *testing.T) {
	out, err := Process(encodeJPEG(t, solid(64, 64, color.NRGBA{G: 200, A: 255})), testMaxBytes)
	if err != nil {
		t.Fatal(err)
	}
	if out.ContentType != ContentTypeJPEG {
		t.Fatalf("content type = %s, want %s", out.ContentType, ContentTypeJPEG)
	}
	if _, format := decode(t, out.Data); format != "jpeg" {
		t.Fatalf("stored format = %s, want jpeg", format)
	}
}

func TestProcessRejectsSVGAndOtherNonImages(t *testing.T) {
	cases := map[string][]byte{
		"svg":        []byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`),
		"svg prolog": []byte(`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>`),
		"html":       []byte(`<!DOCTYPE html><html><script>alert(1)</script></html>`),
		"plain text": []byte("just some text"),
		"gif":        []byte("GIF89a\x01\x00\x01\x00\x00\x00\x00;"),
		"empty":      {},
	}
	for name, data := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := Process(data, testMaxBytes); !errors.Is(err, ErrUnsupportedType) {
				t.Fatalf("err = %v, want ErrUnsupportedType", err)
			}
		})
	}
}

func TestProcessIgnoresWhatTheClientClaims(t *testing.T) {
	// Process never sees a Content-Type or filename, so an HTML file "named
	// icon.png" is judged on its bytes alone.
	html := []byte("<html><body>not a png</body></html>")
	if _, err := Process(html, testMaxBytes); !errors.Is(err, ErrUnsupportedType) {
		t.Fatalf("err = %v, want ErrUnsupportedType", err)
	}
}

func TestProcessDropsPayloadAppendedToAValidImage(t *testing.T) {
	payload := []byte("<script>alert(document.domain)</script>")

	for name, valid := range map[string][]byte{
		"png":  encodePNG(t, solid(16, 16, color.NRGBA{B: 255, A: 255})),
		"jpeg": encodeJPEG(t, solid(16, 16, color.NRGBA{B: 255, A: 255})),
	} {
		t.Run(name, func(t *testing.T) {
			polyglot := append(append([]byte{}, valid...), payload...)
			out, err := Process(polyglot, testMaxBytes)
			if err != nil {
				t.Fatal(err)
			}
			if bytes.Contains(out.Data, []byte("<script>")) {
				t.Fatal("trailing payload survived the re-encode")
			}
		})
	}
}

func TestProcessDropsEXIF(t *testing.T) {
	input := withEXIFOrientation(encodeJPEG(t, solid(16, 16, color.NRGBA{R: 255, A: 255})), 1)
	if !bytes.Contains(input, []byte("Exif")) {
		t.Fatal("test setup: input should carry EXIF")
	}
	out, err := Process(input, testMaxBytes)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(out.Data, []byte("Exif")) {
		t.Fatal("EXIF survived the re-encode")
	}
}

func TestProcessAppliesEXIFOrientationBeforeDroppingIt(t *testing.T) {
	// 8x4, left half red, right half blue. Orientation 6 means "rotate 90
	// degrees clockwise to display": the result is 4x8 with red on top.
	src := solid(8, 4, color.NRGBA{B: 255, A: 255})
	for y := 0; y < 4; y++ {
		for x := 0; x < 4; x++ {
			src.SetNRGBA(x, y, color.NRGBA{R: 255, A: 255})
		}
	}

	out, err := Process(withEXIFOrientation(encodeJPEG(t, src), 6), testMaxBytes)
	if err != nil {
		t.Fatal(err)
	}
	img, _ := decode(t, out.Data)
	if got := img.Bounds(); got.Dx() != 4 || got.Dy() != 8 {
		t.Fatalf("size = %dx%d, want 4x8", got.Dx(), got.Dy())
	}
	top := color.NRGBAModel.Convert(img.At(2, 1)).(color.NRGBA)
	bottom := color.NRGBAModel.Convert(img.At(2, 6)).(color.NRGBA)
	if top.R < 200 || top.B > 80 {
		t.Fatalf("top pixel = %+v, want red", top)
	}
	if bottom.B < 200 || bottom.R > 80 {
		t.Fatalf("bottom pixel = %+v, want blue", bottom)
	}
}

func TestOrientMapsEveryOrientation(t *testing.T) {
	// A 3x2 image whose pixels are numbered so each position is unique.
	src := image.NewNRGBA(image.Rect(0, 0, 3, 2))
	for y := 0; y < 2; y++ {
		for x := 0; x < 3; x++ {
			src.SetNRGBA(x, y, color.NRGBA{R: uint8(y*3 + x + 1), A: 255})
		}
	}
	// Source layout (row-major): 1 2 3 / 4 5 6. Expected output rows per
	// EXIF orientation value.
	want := map[int][][]uint8{
		2: {{3, 2, 1}, {6, 5, 4}},
		3: {{6, 5, 4}, {3, 2, 1}},
		4: {{4, 5, 6}, {1, 2, 3}},
		5: {{1, 4}, {2, 5}, {3, 6}},
		6: {{4, 1}, {5, 2}, {6, 3}},
		7: {{6, 3}, {5, 2}, {4, 1}},
		8: {{3, 6}, {2, 5}, {1, 4}},
	}
	for orientation, rows := range want {
		got := orient(src, orientation)
		if got.Bounds().Dy() != len(rows) || got.Bounds().Dx() != len(rows[0]) {
			t.Fatalf("orientation %d: size %v, want %dx%d", orientation, got.Bounds().Size(), len(rows[0]), len(rows))
		}
		for y, row := range rows {
			for x, v := range row {
				if r := got.NRGBAAt(x, y).R; r != v {
					t.Errorf("orientation %d: pixel (%d,%d) = %d, want %d", orientation, x, y, r, v)
				}
			}
		}
	}
	if orient(src, 1) != src {
		t.Error("orientation 1 should return the image untouched")
	}
}

func TestProcessScalesLargeImagesDownKeepingAspect(t *testing.T) {
	out, err := Process(encodePNG(t, solid(1024, 512, color.NRGBA{R: 9, A: 255})), testMaxBytes)
	if err != nil {
		t.Fatal(err)
	}
	img, _ := decode(t, out.Data)
	if got := img.Bounds(); got.Dx() != 512 || got.Dy() != 256 {
		t.Fatalf("size = %dx%d, want 512x256", got.Dx(), got.Dy())
	}
}

func TestProcessDoesNotUpscaleSmallImages(t *testing.T) {
	out, err := Process(encodePNG(t, solid(40, 30, color.NRGBA{R: 9, A: 255})), testMaxBytes)
	if err != nil {
		t.Fatal(err)
	}
	img, _ := decode(t, out.Data)
	if got := img.Bounds(); got.Dx() != 40 || got.Dy() != 30 {
		t.Fatalf("size = %dx%d, want 40x30", got.Dx(), got.Dy())
	}
}

func TestProcessRejectsOversizedFile(t *testing.T) {
	data := encodePNG(t, solid(8, 8, color.NRGBA{A: 255}))
	if _, err := Process(data, len(data)-1); !errors.Is(err, ErrTooLarge) {
		t.Fatalf("err = %v, want ErrTooLarge", err)
	}
	if _, err := Process(data, len(data)); err != nil {
		t.Fatalf("a file exactly at the limit must pass, got %v", err)
	}
}

func TestProcessRejectsHugeDimensionsBeforeDecoding(t *testing.T) {
	// 5000x5000 grey compresses to a few dozen KB but would need ~100 MB as
	// RGBA: the header check must refuse it first.
	data := encodePNG(t, image.NewGray(image.Rect(0, 0, 5000, 5000)))
	if len(data) > testMaxBytes {
		t.Fatalf("test setup: %d bytes is over the upload limit", len(data))
	}
	if _, err := Process(data, testMaxBytes); !errors.Is(err, ErrDimensions) {
		t.Fatalf("err = %v, want ErrDimensions", err)
	}
}

func TestProcessRejectsTruncatedImage(t *testing.T) {
	data := encodePNG(t, solid(64, 64, color.NRGBA{R: 1, A: 255}))
	if _, err := Process(data[:len(data)/2], testMaxBytes); !errors.Is(err, ErrUnreadable) {
		t.Fatalf("err = %v, want ErrUnreadable", err)
	}
}

func TestProcessWebP(t *testing.T) {
	// Tiny 1x1 files from the WebP feature-detection snippets.
	opaque := mustBase64(t, "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA")
	transparent := mustBase64(t, "UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAARBxAR/Q9ERP8DAABWUDggGAAAABQBAJ0BKgEAAQAAAP4AAA3AAP7mtQAAAA==")

	got, err := Process(opaque, testMaxBytes)
	if err != nil {
		t.Fatalf("opaque webp: %v", err)
	}
	if got.ContentType != ContentTypeJPEG {
		t.Errorf("opaque webp stored as %s, want %s", got.ContentType, ContentTypeJPEG)
	}

	got, err = Process(transparent, testMaxBytes)
	if err != nil {
		t.Fatalf("transparent webp: %v", err)
	}
	if got.ContentType != ContentTypePNG {
		t.Errorf("transparent webp stored as %s, want %s", got.ContentType, ContentTypePNG)
	}
}

func mustBase64(t *testing.T, s string) []byte {
	t.Helper()
	b, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func TestJPEGOrientationIgnoresMalformedMetadata(t *testing.T) {
	base := encodeJPEG(t, solid(8, 8, color.NRGBA{A: 255}))
	cases := map[string][]byte{
		"no exif":        base,
		"truncated exif": withEXIFOrientation(base, 6)[:14],
		"bad value":      withEXIFOrientation(base, 9),
	}
	for name, data := range cases {
		if got := jpegOrientation(data); got != 1 {
			t.Errorf("%s: orientation = %d, want 1", name, got)
		}
	}
	if got := jpegOrientation(withEXIFOrientation(base, 8)); got != 8 {
		t.Errorf("valid exif: orientation = %d, want 8", got)
	}
}

// The pixel cap alone is not enough: a 16-bit image is twice the memory of an
// 8-bit one with the same dimensions.
func TestProcessCapsDecodedMemoryByColourDepth(t *testing.T) {
	// 3000x3000 is 9 MP, under MaxPixels, but 16-bit RGBA decodes to 72 MB.
	deep := image.NewNRGBA64(image.Rect(0, 0, 3000, 3000))
	data := encodePNG(t, deep)
	if len(data) > testMaxBytes {
		t.Fatalf("test setup: %d bytes is over the upload limit", len(data))
	}
	if _, err := Process(data, testMaxBytes); !errors.Is(err, ErrDimensions) {
		t.Fatalf("a 3000x3000 16-bit PNG: err = %v, want ErrDimensions", err)
	}

	// The same size in 8-bit grey is 9 MB and is fine.
	if _, err := Process(encodePNG(t, image.NewGray(image.Rect(0, 0, 3000, 3000))), testMaxBytes); err != nil {
		t.Fatalf("a 3000x3000 8-bit grey PNG must pass: %v", err)
	}
}

func TestBytesPerPixel(t *testing.T) {
	cases := map[string]struct {
		model color.Model
		want  int
	}{
		"gray":    {color.GrayModel, 1},
		"gray16":  {color.Gray16Model, 2},
		"ycbcr":   {color.YCbCrModel, 2},
		"rgba":    {color.RGBAModel, 4},
		"nrgba":   {color.NRGBAModel, 4},
		"rgba64":  {color.RGBA64Model, 8},
		"nrgba64": {color.NRGBA64Model, 8},
		"palette": {color.Palette{color.Black, color.White}, 1},
	}
	for name, tc := range cases {
		if got := bytesPerPixel(tc.model); got != tc.want {
			t.Errorf("%s: %d, want %d", name, got, tc.want)
		}
	}
}

// However many uploads arrive together, no more than maxConcurrentDecodes
// bitmaps are in memory at once.
func TestProcessBoundsConcurrentDecodes(t *testing.T) {
	var running, peak atomic.Int32
	onDecodeStart = func() {
		n := running.Add(1)
		for {
			old := peak.Load()
			if n <= old || peak.CompareAndSwap(old, n) {
				break
			}
		}
		time.Sleep(30 * time.Millisecond)
		running.Add(-1)
	}
	t.Cleanup(func() { onDecodeStart = nil })

	data := encodePNG(t, solid(32, 32, color.NRGBA{R: 1, A: 255}))
	var wg sync.WaitGroup
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := Process(data, testMaxBytes); err != nil {
				t.Errorf("Process: %v", err)
			}
		}()
	}
	wg.Wait()

	if got := peak.Load(); got > maxConcurrentDecodes {
		t.Fatalf("%d decodes ran at once, the cap is %d", got, maxConcurrentDecodes)
	}
	if peak.Load() < 2 {
		t.Fatal("test setup: decodes never overlapped, so the cap was not exercised")
	}
}
