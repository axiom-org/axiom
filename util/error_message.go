package util

// An error message has no computer-readable meaning.
// It is just an encapsulation to be shown to a human for debugging.
type ErrorMessage struct {
	Error string `json:"error"`
}

func (m *ErrorMessage) Slot() int {
	return 0
}

func (m *ErrorMessage) MessageType() string {
	return "Error"
}

func (m *ErrorMessage) String() string {
	return m.Error
}

func init() {
	RegisterMessageType(&ErrorMessage{})
}
