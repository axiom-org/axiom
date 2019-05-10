package data

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/axiom-org/axiom/util"
)

// Information we need for database access
type Config struct {
	// The database name
	Database string

	// The user name. $USER gets expanded to the username.
	User string

	// The host the database is on
	Host string

	// The port the database is on
	Port int

	// The database password
	Password string

	// Test-only databases are cleared on startup
	testOnly bool
}

func NewTestConfig(i int) *Config {
	return &Config{
		Database: fmt.Sprintf("test%d", i),
		User:     "$USER",
		Host:     "127.0.0.1",
		Port:     5432,
		Password: "test",
		testOnly: true,
	}
}

// Prod databases are configured via environment variables.
// Returns nil if the environment variables are not set.
func NewProdConfig() *Config {
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	if len(user) == 0 || len(password) == 0 {
		return nil
	}

	return &Config{
		Database: "prod",
		User:     user,
		Host:     "127.0.0.1",
		Port:     5432,
		Password: password,
	}
}

func NewConfigFromSerialized(serialized []byte) *Config {
	c := &Config{}
	err := json.Unmarshal(serialized, c)
	if err != nil {
		panic(err)
	}
	return c
}

func (c *Config) Serialize() []byte {
	return util.PrettyJSON(c)
}

func (c *Config) String() string {
	return string(c.Serialize())
}
