package imageupload

import (
	"encoding/base64"
	"errors"
	"image"
	"image/color"

	"sync"
	"sync/atomic"
	"testing"
	"time"
)

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
