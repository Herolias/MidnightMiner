import * as bip39 from 'bip39';
import * as C from '@emurgo/cardano-serialization-lib-nodejs';
import * as CMS from '@emurgo/cardano-message-signing-nodejs';

export class Wallet {
    mnemonic: string;
    address: string;
    private rootKey: C.Bip32PrivateKey;
    private accountKey: C.Bip32PrivateKey;
    private utxoPubKey: C.Bip32PublicKey;
    private stakeKey: C.Bip32PublicKey;
    private baseAddress: C.BaseAddress;

    constructor() {
        this.mnemonic = bip39.generateMnemonic(256);
        const entropy = bip39.mnemonicToEntropy(this.mnemonic);
        this.rootKey = C.Bip32PrivateKey.from_bip39_entropy(
            Buffer.from(entropy, 'hex'),
            Buffer.from('')
        );

        this.accountKey = this.rootKey
            .derive(2147483648 + 1852) // purpose
            .derive(2147483648 + 1815) // coin type
            .derive(2147483648 + 0);   // account index

        this.utxoPubKey = this.accountKey
            .derive(0) // chain
            .derive(0) // index
            .to_public();

        this.stakeKey = this.accountKey
            .derive(2) // chain
            .derive(0) // index
            .to_public();

        this.baseAddress = C.BaseAddress.new(
            C.NetworkInfo.mainnet().network_id(),
            C.Credential.from_keyhash(this.utxoPubKey.to_raw_key().hash()),
            C.Credential.from_keyhash(this.stakeKey.to_raw_key().hash())
        );

        this.address = this.baseAddress.to_address().to_bech32();
    }

    signMessage(message: string): { signature: string; publicKey: string } {
        const messageBytes = Buffer.from(message, 'utf8');
        
        const protectedHeaders = CMS.HeaderMap.new();
        protectedHeaders.set_algorithm_id(CMS.Label.from_algorithm_id(CMS.AlgorithmId.EdDSA));
        protectedHeaders.set_header(
            CMS.Label.new_text("address"), 
            CMS.CBORValue.new_bytes(this.baseAddress.to_address().to_bytes())
        );
    
        const protectedHeadersBytes = protectedHeaders.to_bytes();
        const unprotectedHeaders = CMS.HeaderMap.new();
        
        const headers = CMS.Headers.new(
            CMS.ProtectedHeaderMap.new(protectedHeaders),
            unprotectedHeaders
        );
    
        const builder = CMS.COSESign1Builder.new(
            headers,
            messageBytes,
            false
        );
    
        const toSign = builder.make_data_to_sign().to_bytes();
        
        const privKey = this.accountKey
            .derive(0)
            .derive(0)
            .to_raw_key();
            
        const signature = privKey.sign(toSign).to_bytes();
        const coseSign1 = builder.build(signature);
    
        return {
            signature: Buffer.from(coseSign1.to_bytes()).toString('hex'),
            publicKey: Buffer.from(this.utxoPubKey.to_raw_key().as_bytes()).toString('hex')
        };
    }
}

