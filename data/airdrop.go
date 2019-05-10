package data

import (
	"github.com/lacker/coinkit/util"
)

// Airdrop defines an initial distribution of coins, before any blocks have
// been finalized.
var Airdrop []*Account = []*Account{
	&Account{
		Owner:   util.NewKeyPairFromSecretPhrase("mint").PublicKey().String(),
		Balance: TotalMoney,
	},
}
