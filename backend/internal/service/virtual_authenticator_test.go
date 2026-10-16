package service

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"testing"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/protocol/webauthncbor"
	"github.com/go-webauthn/webauthn/protocol/webauthncose"
)

// virtualAuthenticator is a passkey held by a test "phone": a P-256 key and a
// credential id, answering ceremonies the way a platform authenticator does
// (user verified, "none" attestation). It lets the tests run go-webauthn's
// real verification end to end instead of mocking it.
type virtualAuthenticator struct {
	t         *testing.T
	rpID      string
	origin    string
	key       *ecdsa.PrivateKey
	credID    []byte
	userID    []byte
	signCount uint32
}

const (
	flagUserPresent  = 0x01
	flagUserVerified = 0x04
	flagAttested     = 0x40
)

func newVirtualAuthenticator(t *testing.T, rpID, origin string) *virtualAuthenticator {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	credID := make([]byte, 16)
	_, _ = rand.Read(credID)
	return &virtualAuthenticator{t: t, rpID: rpID, origin: origin, key: key, credID: credID}
}

func b64(b []byte) string { return base64.RawURLEncoding.EncodeToString(b) }

func (a *virtualAuthenticator) clientData(ceremony, challenge string) []byte {
	raw, _ := json.Marshal(map[string]any{"type": ceremony, "challenge": challenge, "origin": a.origin})
	return raw
}

func (a *virtualAuthenticator) authData(flags byte, attested []byte) []byte {
	rpHash := sha256.Sum256([]byte(a.rpID))
	out := append([]byte{}, rpHash[:]...)
	out = append(out, flags)
	out = binary.BigEndian.AppendUint32(out, a.signCount)
	return append(out, attested...)
}

// create answers a registration: the RegistrationResponseJSON a phone returns.
func (a *virtualAuthenticator) create(options protocol.PublicKeyCredentialCreationOptions) []byte {
	a.t.Helper()
	switch id := options.User.ID.(type) {
	case protocol.URLEncodedBase64:
		a.userID = id
	case []byte:
		a.userID = id
	default:
		a.t.Fatalf("unexpected user id type %T", options.User.ID)
	}
	pub, err := webauthncbor.Marshal(webauthncose.EC2PublicKeyData{
		PublicKeyData: webauthncose.PublicKeyData{KeyType: int64(webauthncose.EllipticKey), Algorithm: int64(webauthncose.AlgES256)},
		Curve:         1, // P-256
		XCoord:        padTo32(a.key.X.Bytes()),
		YCoord:        padTo32(a.key.Y.Bytes()),
	})
	if err != nil {
		a.t.Fatal(err)
	}
	attested := make([]byte, 16) // AAGUID: zero for "none"
	attested = binary.BigEndian.AppendUint16(attested, uint16(len(a.credID)))
	attested = append(attested, a.credID...)
	attested = append(attested, pub...)
	attObj, err := webauthncbor.Marshal(map[string]any{
		"fmt": "none", "attStmt": map[string]any{}, "authData": a.authData(flagUserPresent|flagUserVerified|flagAttested, attested),
	})
	if err != nil {
		a.t.Fatal(err)
	}
	raw, _ := json.Marshal(map[string]any{
		"id": b64(a.credID), "rawId": b64(a.credID), "type": "public-key",
		"response": map[string]any{
			"clientDataJSON":    b64(a.clientData("webauthn.create", options.Challenge.String())),
			"attestationObject": b64(attObj),
		},
	})
	return raw
}

// get answers a sign-in: the AuthenticationResponseJSON a phone returns.
func (a *virtualAuthenticator) get(options protocol.PublicKeyCredentialRequestOptions) []byte {
	a.t.Helper()
	a.signCount++
	clientData := a.clientData("webauthn.get", options.Challenge.String())
	authData := a.authData(flagUserPresent|flagUserVerified, nil)
	digest := sha256.Sum256(clientData)
	signed := sha256.Sum256(append(append([]byte{}, authData...), digest[:]...))
	sig, err := ecdsa.SignASN1(rand.Reader, a.key, signed[:])
	if err != nil {
		a.t.Fatal(err)
	}
	raw, _ := json.Marshal(map[string]any{
		"id": b64(a.credID), "rawId": b64(a.credID), "type": "public-key",
		"response": map[string]any{
			"clientDataJSON":    b64(clientData),
			"authenticatorData": b64(authData),
			"signature":         b64(sig),
			"userHandle":        b64(a.userID),
		},
	})
	return raw
}

func padTo32(b []byte) []byte {
	if len(b) >= 32 {
		return b
	}
	return append(make([]byte, 32-len(b)), b...)
}
