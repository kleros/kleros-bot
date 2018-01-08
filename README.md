Kleros Bot contains bots that interact with Kleros contracts. Currently there is only one bot, called KlerosPOC

## setup
Install dependencies
```
yarn
```

You must provide a 64 character hex private key in a .env file in order to sign and broadcast transactions. The address must also have enough funds for gas costs.

You also need to include an address for the arbitrator contract and an eth provider

```
PRIVATE_KEY=...
ETH_PROVIDER=https://kovan.infura.io/...
ARBITRATOR_CONTRACT_ADDRESS=0x...
```

That's it!

## usage

#### start dev
```
yarn dev <bot-type>
```

#### start prod
```
yarn prod <bot-type>
```

#### bot-types
| bot-type        | Use                                                  | Contract  |
| --------------- |------------------------------------------------------| ------|
| KlerosPOC       | Pass periods, repartition tokens and execute rulings | [Link](https://github.com/kleros/kleros/blob/master/contracts/KlerosPOC.sol) |
