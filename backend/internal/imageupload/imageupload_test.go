package imageupload

import (
	"bytes"

	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"

	"testing"
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
