package dto

// AccessRequestRequest is the body of POST /auth/access-requests: someone
// without an account asks the admin who uses AdminEmail for one.
type AccessRequestRequest struct {
	Email      string `json:"email" validate:"required,email,max=254"`
	AdminEmail string `json:"admin_email" validate:"required,email,max=254"`
}

// AccessRequestStatusRequest is the body of POST /auth/access-requests/status,
// sent by the requester's device while its login button waits for approval.
type AccessRequestStatusRequest struct {
	Email string `json:"email" validate:"required,email,max=254"`
}

// AccessRequestStatusResponse is false for anything but a request still
// waiting for an admin (see AccessRequestService.AwaitingApproval).
type AccessRequestStatusResponse struct {
	AwaitingApproval bool `json:"awaiting_approval"`
}

// ApproveAccessRequestRequest is the body of POST
// /auth/access-requests/approve, sent by the page an admin's email link opens.
type ApproveAccessRequestRequest struct {
	Token string `json:"token" validate:"required,max=128"`
}

// ApproveAccessRequestResponse names who was approved, so the page can say so.
type ApproveAccessRequestResponse struct {
	Email string `json:"email"`
}
