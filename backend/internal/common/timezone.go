package common

import (
	"time"
	// Embeds the IANA database in the binary: the runtime image is plain
	// alpine without the tzdata package, so LoadLocation would otherwise fail
	// in production while passing on every developer machine.
	_ "time/tzdata"
)

// appTimezoneFallbackOffset is Vietnam's fixed UTC offset (no DST), used only
// if AppTimezone somehow fails to load — the boundaries stay correct either way.
const appTimezoneFallbackOffset = 7 * 60 * 60

// AppLocation is AppTimezone loaded once. Every cycle, day and week boundary
// in the backend is computed in this location; storage stays UTC.
var AppLocation = loadAppLocation()

func loadAppLocation() *time.Location {
	loc, err := time.LoadLocation(AppTimezone)
	if err != nil {
		return time.FixedZone(AppTimezone, appTimezoneFallbackOffset)
	}
	return loc
}
