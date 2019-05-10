package network

import (
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"time"

	"github.com/axiom-org/axiom/consensus"
	"github.com/axiom-org/axiom/util"
)

type Address struct {
	Host string
	Port int
}

func (a *Address) String() string {
	return fmt.Sprintf("%s:%d", a.Host, a.Port)
}

type Config struct {
	// Servers maps the public key to the address the node is expected to be at.
	Servers map[string]*Address

	// Threshold defines the quorum for the network
	Threshold int
}

func NewConfigFromSerialized(serialized []byte) *Config {
	c := &Config{}
	err := json.Unmarshal(serialized, c)
	if err != nil {
		util.Logger.Printf("bad network config: %s", string(serialized))
		panic(err)
	}
	return c
}

func (c *Config) Serialize() []byte {
	return util.PrettyJSON(c)
}

func (c *Config) PeerAddresses(keyPair *util.KeyPair) []*Address {
	answer := []*Address{}
	for pub, addr := range c.Servers {
		if keyPair.PublicKey().String() != pub {
			answer = append(answer, addr)
		}
	}
	return answer
}

func (c *Config) QuorumSlice() *consensus.QuorumSlice {
	members := []string{}
	for key, _ := range c.Servers {
		members = append(members, key)
	}
	return consensus.NewQuorumSlice(members, c.Threshold)
}

func (c *Config) GetPort(publicKey string, defaultPort int) int {
	addr := c.Servers[publicKey]
	if addr == nil {
		util.Logger.Printf("No port could be found for %s in the network config.", publicKey)
		return defaultPort
	}
	return addr.Port
}

func (c *Config) RandomAddress() *Address {
	rand.Seed(int64(time.Now().Nanosecond()))
	index := rand.Intn(len(c.Servers))
	i := 0
	for _, address := range c.Servers {
		if i == index {
			return address
		}
		i++
	}
	panic("coding error")
}

// Using a seed prevents multiple networks from accidentally communicating
// with each other if you don't want them to. If you do want different
// programs to communicate with each other on a localhost network, just
// use the same seed, like zero.
func NewLocalhostNetwork(
	firstPort int, num int, seed int) (*Config, []*util.KeyPair) {

	// Require a 2k+1 out of 3k+1 consensus
	threshold := int(math.Ceil(2.0/3.0*float64(num-1))) + 1

	config := &Config{
		Servers:   make(map[string]*Address),
		Threshold: threshold,
	}
	keyPairs := []*util.KeyPair{}

	for port := firstPort; port < firstPort+num; port++ {
		address := &Address{
			Host: "127.0.0.1",
			Port: port,
		}
		kp := util.NewKeyPairFromSecretPhrase(fmt.Sprintf("%d %d", seed, port))
		config.Servers[kp.PublicKey().String()] = address
		keyPairs = append(keyPairs, kp)
	}

	return config, keyPairs
}

const MinUnitTestPort = 7001
const MaxUnitTestPort = 7999

var nextUnitTestPort = MinUnitTestPort

// Avoids port contention which slows down the tests that use ports.
func NewUnitTestNetwork() (*Config, []*util.KeyPair) {
	rand.Seed(int64(time.Now().Nanosecond()))
	num := 4
	if nextUnitTestPort+num > MaxUnitTestPort {
		nextUnitTestPort = MinUnitTestPort
	}
	config, kps := NewLocalhostNetwork(nextUnitTestPort, num, rand.Int())
	nextUnitTestPort += num
	return config, kps
}

func NewLocalNetworkConfig() *Config {
	config, _ := NewLocalhostNetwork(9000, 4, 0)
	return config
}
