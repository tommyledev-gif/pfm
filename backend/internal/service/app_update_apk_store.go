package service

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"regexp"
	"time"

	"github.com/example/pfm/backend/internal/model"
)

const (
	// apkStoreHeaderTimeout bounds the wait for R2 to start answering.
	apkStoreHeaderTimeout = 20 * time.Second
	// apkStoreIdleTimeout bounds one stalled read from R2 mid-download. There
	// is no limit on the download as a whole: an APK is tens of MB and a phone
	// on a slow network may take minutes, which is fine while bytes move.
	apkStoreIdleTimeout = 60 * time.Second
)

// singleByteRange is the only Range form passed on to R2: one range, as a
// download manager resuming a file sends. Anything else is ignored and the
// whole file is served, which RFC 9110 allows.
var singleByteRange = regexp.MustCompile(`^bytes=(\d+-\d*|-\d+)$`)

// StoredAPK is the newest APK as read from R2, for the handler to pass on.
type StoredAPK struct {
	// Body is nil when Status is 416. The caller must Close it.
	Body io.ReadCloser
	// Size is the byte count of Body, or -1 if R2 did not say.
	Size int64
	// Status is 200, 206 for a byte range, or 416 for a range past the end.
	Status       int
	ContentRange string
}

func newAPKStoreClient() *http.Client {
	return &http.Client{
		Transport: &http.Transport{
			Proxy:                 http.ProxyFromEnvironment,
			DialContext:           (&net.Dialer{Timeout: 10 * time.Second}).DialContext,
			TLSHandshakeTimeout:   10 * time.Second,
			ResponseHeaderTimeout: apkStoreHeaderTimeout,
			// Raw bytes, so Content-Length is R2's own and the APK reaches the
			// phone exactly as uploaded.
			DisableCompression: true,
			MaxIdleConns:       4,
			IdleConnTimeout:    90 * time.Second,
		},
		// No client Timeout: it would cap the whole download (see
		// apkStoreIdleTimeout). Redirects are not followed: the URL comes from
		// latest.json and is the object itself.
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
}

// OpenStoredAPK reads the R2 copy of release so this API can serve the bytes
// itself. Clients only ever talk to /api/v1/app-updates/apk; the bucket's
// address never reaches them (it used to, in a 302 Location header).
//
// method is GET or HEAD. byteRange is the client's Range header, passed on
// only when it is a single range.
func (s *AppUpdateService) OpenStoredAPK(release *model.AppRelease, method, byteRange string) (*StoredAPK, error) {
	ctx, cancel := context.WithCancel(context.Background())
	req, err := http.NewRequestWithContext(ctx, method, release.URL, nil)
	if err != nil {
		cancel()
		return nil, fmt.Errorf("service.AppUpdate.OpenStoredAPK: %w", err)
	}
	if singleByteRange.MatchString(byteRange) {
		req.Header.Set("Range", byteRange)
	}
	resp, err := s.apkStore.Do(req)
	if err != nil {
		cancel()
		return nil, fmt.Errorf("service.AppUpdate.OpenStoredAPK: %w", err)
	}
	switch resp.StatusCode {
	case http.StatusOK, http.StatusPartialContent:
		return &StoredAPK{
			Body:         newIdleTimeoutBody(resp.Body, cancel, apkStoreIdleTimeout),
			Size:         resp.ContentLength,
			Status:       resp.StatusCode,
			ContentRange: resp.Header.Get("Content-Range"),
		}, nil
	case http.StatusRequestedRangeNotSatisfiable:
		resp.Body.Close()
		cancel()
		return &StoredAPK{Size: 0, Status: resp.StatusCode, ContentRange: resp.Header.Get("Content-Range")}, nil
	default:
		resp.Body.Close()
		cancel()
		// Status only: the object's URL stays out of the logs as well.
		return nil, fmt.Errorf("service.AppUpdate.OpenStoredAPK: R2 answered %d", resp.StatusCode)
	}
}

// idleTimeoutBody cancels the request when a single Read waits on R2 longer
// than idle. Only time spent inside Read counts, not the time the caller then
// takes to write the chunk on to a slow phone.
type idleTimeoutBody struct {
	body   io.ReadCloser
	cancel context.CancelFunc
	timer  *time.Timer
	idle   time.Duration
}

func newIdleTimeoutBody(body io.ReadCloser, cancel context.CancelFunc, idle time.Duration) *idleTimeoutBody {
	timer := time.AfterFunc(idle, cancel)
	timer.Stop()
	return &idleTimeoutBody{body: body, cancel: cancel, timer: timer, idle: idle}
}

func (b *idleTimeoutBody) Read(p []byte) (int, error) {
	b.timer.Reset(b.idle)
	n, err := b.body.Read(p)
	b.timer.Stop()
	return n, err
}

func (b *idleTimeoutBody) Close() error {
	b.timer.Stop()
	b.cancel()
	return b.body.Close()
}
