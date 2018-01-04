Kleros Bot runs processes that track an instance of a kleros arbitrator and perform tasks such as advancing the period or executing contracts

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

#### start processes
```
yarn start
```
