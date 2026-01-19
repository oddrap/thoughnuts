// Web3 Wallet Connection Module

window.connectedWallet = null;
window.walletBalances = {};

// RPC Endpoints
const RPC_ENDPOINTS = {
    ethereum: 'https://eth.llamarpc.com',
    base: 'https://mainnet.base.org',
    avalanche: 'https://api.avax.network/ext/bc/C/rpc',
    solana: 'https://api.mainnet-beta.solana.com'
};

// Token Contract Addresses
const TOKEN_CONTRACTS = {
    // Ethereum Mainnet
    USDT_ETH: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    USDC_ETH: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    // Base Mainnet
    USDC_BASE: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    // Avalanche C-Chain
    USDT_AVAX: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
    USDC_AVAX: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    // Solana (SPL Token Mints)
    USDT_SOL: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    USDC_SOL: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
};

// ERC20 ABI for balanceOf
const ERC20_ABI = [
    {
        "constant": true,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    }
];

// Admin addresses (lowercase for comparison)
const ADMIN_ADDRESSES = [
    '0x360091e9e692b7775543da956b7ca6cc39bae86c'
];

function isAdmin(address) {
    return ADMIN_ADDRESSES.includes(address.toLowerCase());
}

// Modal Functions
function openWalletModal() {
    const modal = document.getElementById('walletModal');
    const content = document.getElementById('walletModalContent');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function closeWalletModal() {
    const modal = document.getElementById('walletModal');
    const content = document.getElementById('walletModalContent');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        // Reset to main view when closing
        showWalletSelect();
    }, 200);
}

// Modal View Navigation
function showWalletSelect() {
    document.getElementById('walletSelectView')?.classList.remove('hidden');
    document.getElementById('metamaskOptionsView')?.classList.add('hidden');
    document.getElementById('phantomOptionsView')?.classList.add('hidden');
    document.getElementById('baseOptionsView')?.classList.add('hidden');
    document.getElementById('avalancheOptionsView')?.classList.add('hidden');
}

function showMetamaskOptions() {
    document.getElementById('walletSelectView')?.classList.add('hidden');
    document.getElementById('metamaskOptionsView')?.classList.remove('hidden');
    document.getElementById('phantomOptionsView')?.classList.add('hidden');
    document.getElementById('baseOptionsView')?.classList.add('hidden');
    document.getElementById('avalancheOptionsView')?.classList.add('hidden');
}

function showPhantomOptions() {
    document.getElementById('walletSelectView')?.classList.add('hidden');
    document.getElementById('metamaskOptionsView')?.classList.add('hidden');
    document.getElementById('phantomOptionsView')?.classList.remove('hidden');
    document.getElementById('baseOptionsView')?.classList.add('hidden');
    document.getElementById('avalancheOptionsView')?.classList.add('hidden');
}

function showBaseOptions() {
    document.getElementById('walletSelectView')?.classList.add('hidden');
    document.getElementById('metamaskOptionsView')?.classList.add('hidden');
    document.getElementById('phantomOptionsView')?.classList.add('hidden');
    document.getElementById('baseOptionsView')?.classList.remove('hidden');
    document.getElementById('avalancheOptionsView')?.classList.add('hidden');
}

function showAvalancheOptions() {
    document.getElementById('walletSelectView')?.classList.add('hidden');
    document.getElementById('metamaskOptionsView')?.classList.add('hidden');
    document.getElementById('phantomOptionsView')?.classList.add('hidden');
    document.getElementById('baseOptionsView')?.classList.add('hidden');
    document.getElementById('avalancheOptionsView')?.classList.remove('hidden');
}

// Wallet Dropdown Functions
function openWalletDropdown() {
    const dropdown = document.getElementById('walletDropdown');
    dropdown.classList.remove('hidden');
    updateNetworkChecks();
}

function closeWalletDropdown() {
    const dropdown = document.getElementById('walletDropdown');
    dropdown.classList.add('hidden');
}

function toggleWalletDropdown() {
    const dropdown = document.getElementById('walletDropdown');
    if (dropdown.classList.contains('hidden')) {
        openWalletDropdown();
        // Fetch balances when opening dropdown
        fetchAllBalances();
    } else {
        closeWalletDropdown();
    }
}

function updateNetworkChecks() {
    // Hide all checks first
    document.getElementById('networkCheckEth')?.classList.add('hidden');
    document.getElementById('networkCheckBase')?.classList.add('hidden');
    document.getElementById('networkCheckAvax')?.classList.add('hidden');
    document.getElementById('networkCheckSol')?.classList.add('hidden');

    // Show check for current network
    if (window.connectedWallet) {
        const chain = window.connectedWallet.chain;
        if (chain === 'ethereum') {
            document.getElementById('networkCheckEth')?.classList.remove('hidden');
        } else if (chain === 'base') {
            document.getElementById('networkCheckBase')?.classList.remove('hidden');
        } else if (chain === 'avalanche') {
            document.getElementById('networkCheckAvax')?.classList.remove('hidden');
        } else if (chain === 'solana') {
            document.getElementById('networkCheckSol')?.classList.remove('hidden');
        }
    }
}

async function switchNetwork(network) {
    if (!window.connectedWallet) return;

    // For EVM chains (Ethereum, Base, Avalanche), we can switch networks in MetaMask
    if (network === 'ethereum' || network === 'base' || network === 'avalanche') {
        if (typeof window.ethereum === 'undefined') {
            alert('Please install MetaMask');
            return;
        }

        const chainIds = {
            'ethereum': '0x1',      // Mainnet
            'base': '0x2105',       // Base Mainnet (8453)
            'avalanche': '0xa86a'   // Avalanche C-Chain
        };

        const chainIcons = {
            'ethereum': '⟠',
            'base': '🔵',
            'avalanche': '🔺'
        };

        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: chainIds[network] }]
            });

            // Update connected wallet chain
            window.connectedWallet.chain = network;
            localStorage.setItem('connectedWallet', JSON.stringify(window.connectedWallet));
            updateNetworkChecks();

            // Update button icon
            const btnText = document.getElementById('walletBtnText');
            if (btnText && window.connectedWallet.address) {
                const shortAddress = window.connectedWallet.address.substring(0, 6) + '...' + window.connectedWallet.address.substring(window.connectedWallet.address.length - 4);
                btnText.textContent = `${chainIcons[network]} ${shortAddress}`;
            }

            // Refresh balances for the new network
            fetchAllBalances();

        } catch (error) {
            // Chain not added, try to add it
            if (error.code === 4902) {
                try {
                    const chainConfigs = {
                        'base': {
                            chainId: '0x2105',
                            chainName: 'Base',
                            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                            rpcUrls: ['https://mainnet.base.org'],
                            blockExplorerUrls: ['https://basescan.org/']
                        },
                        'avalanche': {
                            chainId: '0xa86a',
                            chainName: 'Avalanche C-Chain',
                            nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
                            rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
                            blockExplorerUrls: ['https://snowtrace.io/']
                        }
                    };

                    if (chainConfigs[network]) {
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [chainConfigs[network]]
                        });
                        window.connectedWallet.chain = network;
                        localStorage.setItem('connectedWallet', JSON.stringify(window.connectedWallet));
                        updateNetworkChecks();
                        // Refresh balances after adding network
                        fetchAllBalances();
                    }
                } catch (addError) {
                    console.error(`Failed to add ${network} network:`, addError);
                }
            } else {
                console.error('Failed to switch network:', error);
            }
        }
    } else if (network === 'solana') {
        // For Solana, just update the UI - actual Phantom check happens at tip time
        window.connectedWallet.chain = 'solana';
        localStorage.setItem('connectedWallet', JSON.stringify(window.connectedWallet));
        updateNetworkChecks();

        // Update button icon to show Solana
        const btnText = document.getElementById('walletBtnText');
        if (btnText && window.connectedWallet.address) {
            const shortAddress = window.connectedWallet.address.substring(0, 6) + '...' + window.connectedWallet.address.substring(window.connectedWallet.address.length - 4);
            btnText.textContent = `◎ ${shortAddress}`;
        }

        // Refresh balances for Solana
        fetchAllBalances();
    }

    closeWalletDropdown();
}

// Ethereum (MetaMask) Connection
async function connectMetaMask() {
    if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask to connect with Ethereum!');
        window.open('https://metamask.io/download/', '_blank');
        return null;
    }

    try {
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });
        return accounts[0];
    } catch (error) {
        console.error('MetaMask connection error:', error);
        return null;
    }
}

// WalletConnect Provider instance
let walletConnectProvider = null;

// WalletConnect Connection (QR Code)
async function connectWalletConnect() {
    const statusEl = document.getElementById('walletStatus');
    const qrCodeEl = document.getElementById('qrCode');

    showQrCodeView();

    // Show loading spinner
    qrCodeEl.innerHTML = '<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>';

    try {
        // Create WalletConnect Provider
        walletConnectProvider = new WalletConnectProvider.default({
            rpc: {
                1: 'https://eth.llamarpc.com',
                137: 'https://polygon-rpc.com',
                43114: 'https://api.avax.network/ext/bc/C/rpc'
            },
            qrcodeModalOptions: {
                mobileLinks: ['metamask', 'trust', 'rainbow', 'argent', 'imtoken']
            }
        });

        // Get the URI for QR code before enabling
        walletConnectProvider.connector.on('display_uri', (err, payload) => {
            const uri = payload.params[0];

            // Generate QR code
            qrCodeEl.innerHTML = '';
            if (typeof QRCode !== 'undefined') {
                QRCode.toCanvas(qrCodeEl, uri, {
                    width: 192,
                    margin: 0,
                    color: {
                        dark: '#000000',
                        light: '#ffffff'
                    }
                }, function(error) {
                    if (error) {
                        console.error('QR Code error:', error);
                        qrCodeEl.innerHTML = '<p class="text-red-500 text-sm">QR generation failed</p>';
                    }
                });
            }
        });

        // Enable session (triggers QR modal or uses existing session)
        const accounts = await walletConnectProvider.enable();

        if (accounts && accounts.length > 0) {
            const address = accounts[0];

            // Successfully connected
            statusEl.classList.remove('hidden');
            statusEl.innerHTML = '<span class="text-green-400">Connected! Authenticating...</span>';

            // Now authenticate with the server
            await authenticateWalletConnect(address);
        }

    } catch (error) {
        console.error('WalletConnect error:', error);
        statusEl.classList.remove('hidden');

        if (error.message?.includes('User closed')) {
            statusEl.innerHTML = '<span class="text-yellow-400">Connection cancelled</span>';
        } else {
            statusEl.innerHTML = '<span class="text-red-500">Connection failed. Please try again.</span>';
        }

        setTimeout(() => {
            statusEl.classList.add('hidden');
            showEthereumOptions();
        }, 2000);
    }
}

// Authenticate after WalletConnect connection
async function authenticateWalletConnect(address) {
    const statusEl = document.getElementById('walletStatus');

    try {
        // Get nonce from server
        const nonceResponse = await fetch('/api/auth/nonce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet_address: address,
                wallet_type: 'ethereum'
            })
        });

        if (!nonceResponse.ok) throw new Error('Failed to get nonce');

        const { nonce, message } = await nonceResponse.json();

        statusEl.innerHTML = '<span class="text-blue-400">Please sign the message in your wallet...</span>';

        // Sign with WalletConnect
        const web3 = new Web3(walletConnectProvider);
        const signature = await web3.eth.personal.sign(message, address, '');

        // Verify signature with server
        const verifyResponse = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet_address: address,
                wallet_type: 'ethereum',
                signature: signature,
                message: message
            })
        });

        const verifyResult = await verifyResponse.json();

        if (verifyResult.success) {
            // Store connection info
            window.connectedWallet = {
                address: address,
                chain: 'ethereum',
                token: verifyResult.session_token,
                provider: 'walletconnect'
            };

            localStorage.setItem('connectedWallet', JSON.stringify(window.connectedWallet));

            // Update UI
            updateWalletUI(address, 'ethereum');
            closeWalletModal();

            statusEl.innerHTML = '<span class="text-green-400">Connected successfully!</span>';
        } else {
            statusEl.innerHTML = '<span class="text-red-500">Authentication failed</span>';
        }
    } catch (error) {
        console.error('WalletConnect auth error:', error);
        statusEl.innerHTML = '<span class="text-red-500">Authentication failed</span>';
    }

    setTimeout(() => statusEl.classList.add('hidden'), 3000);
}

// Disconnect WalletConnect
async function disconnectWalletConnect() {
    if (walletConnectProvider) {
        try {
            await walletConnectProvider.disconnect();
        } catch (e) {
            console.log('WalletConnect disconnect:', e);
        }
        walletConnectProvider = null;
    }
}

// =============================================
// NEW CONNECTION FUNCTIONS (Extension / Mobile)
// =============================================

// MetaMask - Browser Extension
async function connectMetamaskExtension() {
    const statusEl = document.getElementById('walletStatus');
    statusEl.classList.remove('hidden');
    statusEl.innerHTML = '<span class="text-blue-400">Connecting to MetaMask...</span>';

    if (typeof window.ethereum === 'undefined') {
        statusEl.innerHTML = '<span class="text-red-500">MetaMask not found. Please install the extension.</span>';
        setTimeout(() => {
            window.open('https://metamask.io/download/', '_blank');
            statusEl.classList.add('hidden');
        }, 2000);
        return;
    }

    try {
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });

        if (accounts && accounts.length > 0) {
            await authenticateWallet(accounts[0], 'ethereum', 'metamask');
        }
    } catch (error) {
        console.error('MetaMask connection error:', error);
        statusEl.innerHTML = '<span class="text-red-500">Connection failed. Please try again.</span>';
        setTimeout(() => statusEl.classList.add('hidden'), 3000);
    }
}

// MetaMask - Mobile (deep link)
function connectMetamaskMobile() {
    const statusEl = document.getElementById('walletStatus');
    statusEl.classList.remove('hidden');

    // Check if on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
        // Create MetaMask deep link
        // Format: https://metamask.app.link/dapp/{url}
        const currentUrl = window.location.host + window.location.pathname;
        const metamaskDeepLink = `https://metamask.app.link/dapp/${currentUrl}`;

        statusEl.innerHTML = '<span class="text-blue-400">Opening MetaMask app...</span>';

        // Try to open MetaMask
        window.location.href = metamaskDeepLink;

        setTimeout(() => {
            statusEl.innerHTML = '<span class="text-primary-400">If MetaMask didn\'t open, please install the app.</span>';
        }, 3000);
    } else {
        // On desktop, show message to use extension or scan QR with phone
        statusEl.innerHTML = '<span class="text-yellow-400">Please use Browser Extension on desktop, or visit this site from your mobile device.</span>';
        setTimeout(() => statusEl.classList.add('hidden'), 4000);
    }
}

// Phantom - Browser Extension
async function connectPhantomExtension() {
    const statusEl = document.getElementById('walletStatus');
    statusEl.classList.remove('hidden');
    statusEl.innerHTML = '<span class="text-blue-400">Connecting to Phantom...</span>';

    if (typeof window.solana === 'undefined' || !window.solana.isPhantom) {
        statusEl.innerHTML = '<span class="text-red-500">Phantom not found. Please install the extension.</span>';
        setTimeout(() => {
            window.open('https://phantom.app/', '_blank');
            statusEl.classList.add('hidden');
        }, 2000);
        return;
    }

    try {
        const response = await window.solana.connect();
        const address = response.publicKey.toString();

        if (address) {
            await authenticateWallet(address, 'solana', 'phantom');
        }
    } catch (error) {
        console.error('Phantom connection error:', error);
        statusEl.innerHTML = '<span class="text-red-500">Connection failed. Please try again.</span>';
        setTimeout(() => statusEl.classList.add('hidden'), 3000);
    }
}

// Phantom - Mobile (deep link)
function connectPhantomMobile() {
    const statusEl = document.getElementById('walletStatus');
    statusEl.classList.remove('hidden');

    // Check if on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
        // Create Phantom deep link
        const currentUrl = encodeURIComponent(window.location.href);
        const phantomDeepLink = `https://phantom.app/ul/browse/${currentUrl}?ref=${currentUrl}`;

        statusEl.innerHTML = '<span class="text-blue-400">Opening Phantom app...</span>';

        // Try to open Phantom
        window.location.href = phantomDeepLink;

        setTimeout(() => {
            statusEl.innerHTML = '<span class="text-primary-400">If Phantom didn\'t open, please install the app.</span>';
        }, 3000);
    } else {
        // On desktop, show message to use extension
        statusEl.innerHTML = '<span class="text-yellow-400">Please use Browser Extension on desktop, or visit from mobile.</span>';
        setTimeout(() => statusEl.classList.add('hidden'), 3000);
    }
}

// Base - Browser Extension (uses MetaMask or any EVM wallet)
async function connectBaseExtension() {
    const statusEl = document.getElementById('walletStatus');
    statusEl.classList.remove('hidden');
    statusEl.innerHTML = '<span class="text-blue-400">Connecting to Base...</span>';

    if (typeof window.ethereum === 'undefined') {
        statusEl.innerHTML = '<span class="text-red-500">No wallet found. Please install MetaMask or Coinbase Wallet.</span>';
        setTimeout(() => {
            window.open('https://www.coinbase.com/wallet', '_blank');
            statusEl.classList.add('hidden');
        }, 2000);
        return;
    }

    try {
        // First connect to wallet
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });

        // Try to switch to Base network
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x2105' }] // Base Mainnet
            });
        } catch (switchError) {
            // Chain not added, add it
            if (switchError.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0x2105',
                        chainName: 'Base',
                        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                        rpcUrls: ['https://mainnet.base.org'],
                        blockExplorerUrls: ['https://basescan.org/']
                    }]
                });
            }
        }

        if (accounts && accounts.length > 0) {
            await authenticateWallet(accounts[0], 'base', 'base');
        }
    } catch (error) {
        console.error('Base connection error:', error);
        statusEl.innerHTML = '<span class="text-red-500">Connection failed. Please try again.</span>';
        setTimeout(() => statusEl.classList.add('hidden'), 3000);
    }
}

// Base - Mobile (Coinbase Wallet deep link)
function connectBaseMobile() {
    const statusEl = document.getElementById('walletStatus');
    statusEl.classList.remove('hidden');

    // Check if on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
        // Create Coinbase Wallet deep link for Base
        const currentUrl = encodeURIComponent(window.location.href);
        const coinbaseDeepLink = `https://go.cb-w.com/dapp?cb_url=${currentUrl}`;

        statusEl.innerHTML = '<span class="text-blue-400">Opening Coinbase Wallet...</span>';

        // Try to open Coinbase Wallet
        window.location.href = coinbaseDeepLink;

        setTimeout(() => {
            statusEl.innerHTML = '<span class="text-primary-400">If Coinbase Wallet didn\'t open, please install the app.</span>';
        }, 3000);
    } else {
        // On desktop, show message to use extension
        statusEl.innerHTML = '<span class="text-yellow-400">Please use Browser Extension on desktop, or visit from mobile.</span>';
        setTimeout(() => statusEl.classList.add('hidden'), 3000);
    }
}

// Avalanche - Browser Extension (uses MetaMask or Core Wallet)
async function connectAvalancheExtension() {
    const statusEl = document.getElementById('walletStatus');
    statusEl.classList.remove('hidden');
    statusEl.innerHTML = '<span class="text-blue-400">Connecting to Avalanche...</span>';

    if (typeof window.ethereum === 'undefined') {
        statusEl.innerHTML = '<span class="text-red-500">No wallet found. Please install MetaMask or Core Wallet.</span>';
        setTimeout(() => {
            window.open('https://core.app/', '_blank');
            statusEl.classList.add('hidden');
        }, 2000);
        return;
    }

    try {
        // First connect to wallet
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });

        // Try to switch to Avalanche C-Chain
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0xa86a' }] // Avalanche C-Chain
            });
        } catch (switchError) {
            // Chain not added, add it
            if (switchError.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0xa86a',
                        chainName: 'Avalanche C-Chain',
                        nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
                        rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
                        blockExplorerUrls: ['https://snowtrace.io/']
                    }]
                });
            }
        }

        if (accounts && accounts.length > 0) {
            await authenticateWallet(accounts[0], 'avalanche', 'avalanche');
        }
    } catch (error) {
        console.error('Avalanche connection error:', error);
        statusEl.innerHTML = '<span class="text-red-500">Connection failed. Please try again.</span>';
        setTimeout(() => statusEl.classList.add('hidden'), 3000);
    }
}

// Avalanche - Mobile (Core Wallet deep link)
function connectAvalancheMobile() {
    const statusEl = document.getElementById('walletStatus');
    statusEl.classList.remove('hidden');

    // Check if on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
        // Create Core Wallet deep link for Avalanche
        const currentUrl = encodeURIComponent(window.location.href);
        const coreDeepLink = `https://core.app/discover/browser?url=${currentUrl}`;

        statusEl.innerHTML = '<span class="text-blue-400">Opening Core Wallet...</span>';

        // Try to open Core Wallet
        window.location.href = coreDeepLink;

        setTimeout(() => {
            statusEl.innerHTML = '<span class="text-primary-400">If Core Wallet didn\'t open, please install the app.</span>';
        }, 3000);
    } else {
        // On desktop, show message to use extension
        statusEl.innerHTML = '<span class="text-yellow-400">Please use Browser Extension on desktop, or visit from mobile.</span>';
        setTimeout(() => statusEl.classList.add('hidden'), 3000);
    }
}

// Generic authentication function for wallet connections
async function authenticateWallet(address, chain, walletType) {
    const statusEl = document.getElementById('walletStatus');

    try {
        // For development: simplified connection without server verification
        // This allows testing wallet connection even if server verification fails

        statusEl.innerHTML = '<span class="text-blue-400">Connecting wallet...</span>';
        statusEl.classList.remove('hidden');

        // Store connection info directly (skip server verification for now)
        window.connectedWallet = {
            address: address,
            chain: chain,
            walletType: walletType,
            token: null
        };

        localStorage.setItem('connectedWallet', JSON.stringify(window.connectedWallet));

        // Update UI first, then close modal
        updateWalletUI(address, chain);

        // Update status before closing modal
        statusEl.innerHTML = '<span class="text-green-400">Connected!</span>';

        // Close modal after a short delay so user sees success message
        setTimeout(() => {
            closeWalletModal();
        }, 500);

        return;

        /* Original server verification code (disabled for development)
        // Get nonce from server
        const nonceResponse = await fetch('/api/auth/nonce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet_address: address,
                wallet_type: chain
            })
        });

        if (!nonceResponse.ok) {
            console.error('Nonce request failed:', nonceResponse.status);
            throw new Error('Failed to get nonce');
        }

        const nonceData = await nonceResponse.json();
        const { nonce, message } = nonceData;

        // Sign the message
        statusEl.innerHTML = '<span class="text-blue-400">Please sign the message in your wallet...</span>';

        let signature = null;
        if (chain === 'ethereum') {
            signature = await signMessageEth(message);
        } else if (chain === 'solana') {
            signature = await signMessageSol(message);
        }

        if (!signature) {
            statusEl.innerHTML = '<span class="text-red-500">Signing cancelled or failed.</span>';
            setTimeout(() => statusEl.classList.add('hidden'), 3000);
            return;
        }

        // Verify signature with server
        const verifyResponse = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet_address: address,
                wallet_type: chain,
                signature: signature,
                message: message
            })
        });

        const verifyResult = await verifyResponse.json();

        if (verifyResult.success) {
            window.connectedWallet = {
                address: address,
                chain: chain,
                walletType: walletType,
                token: verifyResult.session_token
            };

            localStorage.setItem('connectedWallet', JSON.stringify(window.connectedWallet));
            updateWalletUI(address, chain);
            closeWalletModal();
            statusEl.innerHTML = '<span class="text-green-400">Connected successfully!</span>';
        } else {
            statusEl.innerHTML = `<span class="text-red-500">${verifyResult.message || 'Authentication failed.'}</span>`;
        }
        */
    } catch (error) {
        console.error('Authentication error:', error);
        statusEl.innerHTML = '<span class="text-red-500">Connection error. Please try again.</span>';
        setTimeout(() => statusEl.classList.add('hidden'), 3000);
    }
}

// Solana (Phantom) Connection
async function connectPhantom() {
    if (typeof window.solana === 'undefined' || !window.solana.isPhantom) {
        alert('Please install Phantom wallet to connect with Solana!');
        window.open('https://phantom.app/', '_blank');
        return null;
    }

    try {
        const response = await window.solana.connect();
        return response.publicKey.toString();
    } catch (error) {
        console.error('Phantom connection error:', error);
        return null;
    }
}

// Sign Message with Ethereum
async function signMessageEth(message) {
    if (!window.ethereum) return null;

    try {
        const accounts = await window.ethereum.request({
            method: 'eth_accounts'
        });
        const signature = await window.ethereum.request({
            method: 'personal_sign',
            params: [message, accounts[0]]
        });
        return signature;
    } catch (error) {
        console.error('Signing error:', error);
        return null;
    }
}

// Sign Message with Solana
async function signMessageSol(message) {
    if (!window.solana) return null;

    try {
        const encodedMessage = new TextEncoder().encode(message);
        const signedMessage = await window.solana.signMessage(encodedMessage, 'utf8');
        // Convert to base58
        return btoa(String.fromCharCode.apply(null, signedMessage.signature));
    } catch (error) {
        console.error('Signing error:', error);
        return null;
    }
}

// Main Connect Function
async function connectWallet(chain, walletType) {
    const statusEl = document.getElementById('walletStatus');
    statusEl.classList.remove('hidden');

    let address = null;

    if (chain === 'ethereum' && walletType === 'metamask') {
        address = await connectMetaMask();
    } else if (chain === 'solana' && walletType === 'phantom') {
        address = await connectPhantom();
    }

    if (!address) {
        statusEl.innerHTML = '<span class="text-red-500">Connection failed. Please try again.</span>';
        setTimeout(() => statusEl.classList.add('hidden'), 3000);
        return;
    }

    // Get nonce from server
    try {
        const nonceResponse = await fetch('/api/auth/nonce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet_address: address,
                wallet_type: chain
            })
        });

        if (!nonceResponse.ok) throw new Error('Failed to get nonce');

        const { nonce, message } = await nonceResponse.json();

        // Sign the message
        statusEl.innerHTML = '<span class="text-primary-500">Please sign the message in your wallet...</span>';

        let signature = null;
        if (chain === 'ethereum') {
            signature = await signMessageEth(message);
        } else if (chain === 'solana') {
            signature = await signMessageSol(message);
        }

        if (!signature) {
            statusEl.innerHTML = '<span class="text-red-500">Signing cancelled or failed.</span>';
            setTimeout(() => statusEl.classList.add('hidden'), 3000);
            return;
        }

        // Verify signature with server
        const verifyResponse = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet_address: address,
                wallet_type: chain,
                signature: signature,
                message: message
            })
        });

        const verifyResult = await verifyResponse.json();

        if (verifyResult.success) {
            // Store connection info
            window.connectedWallet = {
                address: address,
                chain: chain,
                token: verifyResult.session_token
            };

            localStorage.setItem('connectedWallet', JSON.stringify(window.connectedWallet));

            // Update UI
            updateWalletUI(address, chain);
            closeWalletModal();
        } else {
            statusEl.innerHTML = '<span class="text-red-500">Authentication failed. Please try again.</span>';
        }
    } catch (error) {
        console.error('Authentication error:', error);
        statusEl.innerHTML = '<span class="text-red-500">Connection error. Please try again.</span>';
    }

    setTimeout(() => statusEl.classList.add('hidden'), 3000);
}

// Update UI after connection
function updateWalletUI(address, chain) {
    const btn = document.getElementById('connectWalletBtn');
    const btnText = document.getElementById('walletBtnText');
    const btnTextMobile = document.getElementById('walletBtnTextMobile');
    const arrow = document.getElementById('walletDropdownArrow');
    const walletIcon = document.getElementById('walletIcon');
    const adminBadge = document.getElementById('adminBadge');
    const headerBalances = document.getElementById('headerBalances');
    const headerBalancesLoading = document.getElementById('headerBalancesLoading');
    const headerBalancesContent = document.getElementById('headerBalancesContent');
    const mobileBalancesRow = document.getElementById('mobileBalancesRow');

    const shortAddress = address.substring(0, 6) + '...' + address.substring(address.length - 4);
    const mobileShortAddress = address.substring(0, 4) + '..' + address.substring(address.length - 3);
    const chainIcons = {
        'ethereum': '⟠',
        'base': '🔵',
        'avalanche': '🔺',
        'solana': '◎'
    };
    const chainIcon = chainIcons[chain] || '⟠';

    // Desktop: full address
    btnText.textContent = `${chainIcon} ${shortAddress}`;
    // Mobile: shorter address
    if (btnTextMobile) btnTextMobile.textContent = `${chainIcon} ${mobileShortAddress}`;

    btn.onclick = toggleWalletDropdown;

    // Hide wallet icon when connected
    if (walletIcon) walletIcon.classList.add('hidden');

    // Show dropdown arrow
    if (arrow) arrow.classList.remove('hidden');

    // Show header balances section with loading state (desktop)
    if (headerBalances) {
        headerBalances.classList.remove('hidden');
        headerBalances.classList.add('flex');
    }
    if (headerBalancesLoading) headerBalancesLoading.classList.remove('hidden');
    if (headerBalancesContent) headerBalancesContent.classList.add('hidden');

    // Show mobile balances row
    if (mobileBalancesRow) {
        mobileBalancesRow.classList.remove('hidden');
    }

    // Show admin badge if admin
    if (adminBadge) {
        if (isAdmin(address)) {
            adminBadge.classList.remove('hidden');
            window.isAdmin = true;
        } else {
            adminBadge.classList.add('hidden');
            window.isAdmin = false;
        }
    }

    // Fetch balances immediately
    fetchAllBalances();

    // Dispatch event for other components
    window.dispatchEvent(new Event('walletConnected'));
}

// Disconnect wallet
async function disconnectWallet() {
    // Disconnect WalletConnect if it was used
    if (window.connectedWallet?.provider === 'walletconnect') {
        await disconnectWalletConnect();
    }

    window.connectedWallet = null;
    window.isAdmin = false;
    window.walletBalances = {};
    localStorage.removeItem('connectedWallet');

    const btn = document.getElementById('connectWalletBtn');
    const btnText = document.getElementById('walletBtnText');
    const btnTextMobile = document.getElementById('walletBtnTextMobile');
    const arrow = document.getElementById('walletDropdownArrow');
    const walletIcon = document.getElementById('walletIcon');
    const adminBadge = document.getElementById('adminBadge');
    const headerBalances = document.getElementById('headerBalances');
    const mobileBalancesRow = document.getElementById('mobileBalancesRow');

    btnText.textContent = 'Connect Wallet';
    if (btnTextMobile) btnTextMobile.textContent = 'Connect';
    btn.onclick = openWalletModal;

    // Show wallet icon when disconnected
    if (walletIcon) walletIcon.classList.remove('hidden');

    // Hide dropdown arrow
    if (arrow) arrow.classList.add('hidden');

    // Hide admin badge
    if (adminBadge) adminBadge.classList.add('hidden');

    // Hide header balances
    if (headerBalances) {
        headerBalances.classList.add('hidden');
        headerBalances.classList.remove('flex');
    }

    // Hide mobile balances row
    if (mobileBalancesRow) {
        mobileBalancesRow.classList.add('hidden');
    }

    // Close dropdown if open
    closeWalletDropdown();

    // Dispatch event for other components
    window.dispatchEvent(new Event('walletConnected'));
}

// Send crypto tip
async function sendCryptoTip(chain, recipient, amount) {
    if (chain === 'ethereum') {
        return await sendEthTip(recipient, amount);
    } else if (chain === 'solana') {
        return await sendSolTip(recipient, amount);
    }
    return null;
}

// Send ETH tip
async function sendEthTip(recipient, amount) {
    if (!window.ethereum) {
        throw new Error('Please install MetaMask');
    }

    const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
    });

    const weiAmount = '0x' + (parseFloat(amount) * 1e18).toString(16);

    const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
            from: accounts[0],
            to: recipient,
            value: weiAmount
        }]
    });

    return txHash;
}

// Send SOL tip
async function sendSolTip(recipient, amount) {
    if (!window.solana || !window.solana.isPhantom) {
        throw new Error('Please install Phantom wallet');
    }

    // Note: This requires @solana/web3.js to be loaded
    // For simplicity, we'll use a basic transfer
    // In production, you'd want to use the proper Solana SDK

    alert('Solana tipping requires additional setup. Please send SOL directly to: ' + recipient);
    return null;
}

// Check for existing connection on page load
document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('connectedWallet');
    if (saved) {
        try {
            window.connectedWallet = JSON.parse(saved);
            updateWalletUI(window.connectedWallet.address, window.connectedWallet.chain);
        } catch (e) {
            localStorage.removeItem('connectedWallet');
        }
    }
    // Dispatch event for initial state
    window.dispatchEvent(new Event('walletConnected'));
});

// Close modal on backdrop click
document.getElementById('walletModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'walletModal') {
        closeWalletModal();
    }
});

// Close wallet dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('walletDropdown');
    const btn = document.getElementById('connectWalletBtn');
    if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
        closeWalletDropdown();
    }
});

// Listen for account changes (MetaMask)
if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
            disconnectWallet();
        } else if (window.connectedWallet?.chain === 'ethereum') {
            window.connectedWallet.address = accounts[0];
            updateWalletUI(accounts[0], 'ethereum');
        }
    });
}

// Listen for disconnect (Phantom)
if (window.solana) {
    window.solana.on('disconnect', () => {
        if (window.connectedWallet?.chain === 'solana') {
            disconnectWallet();
        }
    });
}

// =============================================
// BALANCE FETCHING FUNCTIONS
// =============================================

// Format balance for display
function formatBalance(balance, decimals = 4) {
    if (balance === null || balance === undefined || isNaN(balance)) return '-';
    if (balance === 0) return '0';
    if (balance < 0.0001) return '<0.0001';
    return balance.toFixed(decimals).replace(/\.?0+$/, '');
}

// Helper function to fetch with timeout
async function fetchWithTimeout(url, options, timeout = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

// Fetch all balances for the connected wallet
async function fetchAllBalances() {
    if (!window.connectedWallet?.address) {
        hideBalanceLoading();
        return;
    }

    const address = window.connectedWallet.address;
    const isEVM = address.startsWith('0x');

    // Show loading state (dropdown)
    document.getElementById('balancesLoading')?.classList.remove('hidden');
    document.getElementById('balancesContent')?.classList.add('hidden');

    // Show loading state (header)
    document.getElementById('headerBalancesLoading')?.classList.remove('hidden');
    document.getElementById('headerBalancesContent')?.classList.add('hidden');

    // Set timeout to force hide loading after 15 seconds
    const loadingTimeout = setTimeout(() => {
        console.warn('Balance fetch timeout - forcing UI update');
        hideBalanceLoading();
    }, 15000);

    try {
        // Fetch balances in parallel
        const promises = [];
        const connectedChain = window.connectedWallet?.chain;

        if (isEVM) {
            // EVM address - fetch all EVM chain balances
            // Fetch ETH
            promises.push(fetchETHBalance(address));
            promises.push(fetchERC20Balance(address, TOKEN_CONTRACTS.USDT_ETH, 6, RPC_ENDPOINTS.ethereum, 'USDT_ETH'));
            promises.push(fetchERC20Balance(address, TOKEN_CONTRACTS.USDC_ETH, 6, RPC_ENDPOINTS.ethereum, 'USDC_ETH'));
            // Fetch Base balance
            promises.push(fetchBaseBalance(address));
            promises.push(fetchERC20Balance(address, TOKEN_CONTRACTS.USDC_BASE, 6, RPC_ENDPOINTS.base, 'USDC_BASE'));
            // Fetch Avalanche balance
            promises.push(fetchAVAXBalance(address));
            promises.push(fetchERC20Balance(address, TOKEN_CONTRACTS.USDT_AVAX, 6, RPC_ENDPOINTS.avalanche, 'USDT_AVAX'));
            promises.push(fetchERC20Balance(address, TOKEN_CONTRACTS.USDC_AVAX, 6, RPC_ENDPOINTS.avalanche, 'USDC_AVAX'));
            // Set Solana balances to N/A for EVM wallets
            updateBalanceDisplay('SOL', null);
            updateBalanceDisplay('USDT_SOL', null);
            updateBalanceDisplay('USDC_SOL', null);
        } else {
            // Solana address - fetch SOL and SPL tokens
            promises.push(fetchSOLBalance(address));
            promises.push(fetchSPLTokenBalance(address, TOKEN_CONTRACTS.USDT_SOL, 'USDT_SOL'));
            promises.push(fetchSPLTokenBalance(address, TOKEN_CONTRACTS.USDC_SOL, 'USDC_SOL'));
            // Set EVM balances to N/A
            updateBalanceDisplay('ETH', null);
            updateBalanceDisplay('BASE', null);
            updateBalanceDisplay('AVAX', null);
            updateBalanceDisplay('USDT_ETH', null);
            updateBalanceDisplay('USDC_ETH', null);
            updateBalanceDisplay('USDC_BASE', null);
            updateBalanceDisplay('USDT_AVAX', null);
            updateBalanceDisplay('USDC_AVAX', null);
        }

        await Promise.allSettled(promises);

    } catch (error) {
        console.error('Error fetching balances:', error);
    } finally {
        clearTimeout(loadingTimeout);
        hideBalanceLoading();
    }
}

// Hide balance loading state and show content
function hideBalanceLoading() {
    // Hide loading, show content (dropdown)
    document.getElementById('balancesLoading')?.classList.add('hidden');
    document.getElementById('balancesContent')?.classList.remove('hidden');

    // Hide loading, show content (header)
    document.getElementById('headerBalancesLoading')?.classList.add('hidden');
    const headerContent = document.getElementById('headerBalancesContent');
    if (headerContent) {
        headerContent.classList.remove('hidden');
        headerContent.classList.add('flex');
    }
}

// Update balance display element
function updateBalanceDisplay(token, balance) {
    // Update dropdown balance
    const el = document.getElementById(`balance${token}`);
    if (el) {
        if (balance === null) {
            el.textContent = 'N/A';
            el.classList.add('text-primary-500');
            el.classList.remove('text-white');
        } else {
            el.textContent = formatBalance(balance);
            el.classList.remove('text-primary-500');
            el.classList.add('text-white');
        }
    }

    // Update header balance (for native tokens - desktop)
    const headerEl = document.getElementById(`headerBalance${token}`);
    if (headerEl) {
        if (balance === null) {
            headerEl.textContent = 'N/A';
        } else {
            headerEl.textContent = formatBalance(balance, 2);
        }
    }

    // Update mobile balance (for native tokens)
    const mobileEl = document.getElementById(`mobileBalance${token}`);
    if (mobileEl) {
        if (balance === null) {
            mobileEl.textContent = 'N/A';
        } else {
            mobileEl.textContent = formatBalance(balance, 2);
        }
    }

    window.walletBalances[token] = balance;

    // Update stablecoin total in header
    updateHeaderStableTotal();
}

// Calculate and update total stablecoins in header
function updateHeaderStableTotal() {
    const stableTokens = ['USDT_ETH', 'USDC_ETH', 'USDC_BASE', 'USDT_AVAX', 'USDC_AVAX', 'USDT_SOL', 'USDC_SOL'];
    let total = 0;

    for (const token of stableTokens) {
        const balance = window.walletBalances[token];
        if (balance !== null && balance !== undefined && !isNaN(balance)) {
            total += balance;
        }
    }

    let stableText;
    if (total === 0) {
        stableText = '$0';
    } else if (total < 0.01) {
        stableText = '<$0.01';
    } else {
        stableText = '$' + total.toFixed(2).replace(/\.?0+$/, '');
    }

    // Update desktop header
    const headerStableEl = document.getElementById('headerBalanceStable');
    if (headerStableEl) {
        headerStableEl.textContent = stableText;
    }

    // Update mobile header
    const mobileStableEl = document.getElementById('mobileBalanceStable');
    if (mobileStableEl) {
        mobileStableEl.textContent = stableText;
    }
}

// Fetch ETH balance
async function fetchETHBalance(address) {
    try {
        const response = await fetchWithTimeout(RPC_ENDPOINTS.ethereum, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_getBalance',
                params: [address, 'latest'],
                id: 1
            })
        }, 8000);
        const data = await response.json();
        const balance = parseInt(data.result, 16) / 1e18;
        updateBalanceDisplay('ETH', balance);
        return balance;
    } catch (error) {
        console.error('Error fetching ETH balance:', error);
        updateBalanceDisplay('ETH', 0);
        return 0;
    }
}

// Fetch Base (ETH on Base) balance
async function fetchBaseBalance(address) {
    try {
        const response = await fetchWithTimeout(RPC_ENDPOINTS.base, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_getBalance',
                params: [address, 'latest'],
                id: 1
            })
        }, 8000);
        const data = await response.json();
        const balance = parseInt(data.result, 16) / 1e18;
        updateBalanceDisplay('BASE', balance);
        return balance;
    } catch (error) {
        console.error('Error fetching Base balance:', error);
        updateBalanceDisplay('BASE', 0);
        return 0;
    }
}

// Fetch AVAX balance
async function fetchAVAXBalance(address) {
    try {
        const response = await fetch(RPC_ENDPOINTS.avalanche, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_getBalance',
                params: [address, 'latest'],
                id: 1
            })
        });
        const data = await response.json();
        const balance = parseInt(data.result, 16) / 1e18;
        updateBalanceDisplay('AVAX', balance);
        return balance;
    } catch (error) {
        console.error('Error fetching AVAX balance:', error);
        updateBalanceDisplay('AVAX', 0);
        return 0;
    }
}

// Fetch ERC20 token balance
async function fetchERC20Balance(address, contractAddress, decimals, rpcUrl, tokenKey) {
    try {
        // balanceOf function signature + padded address
        const data = '0x70a08231' + address.slice(2).padStart(64, '0');

        const response = await fetchWithTimeout(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_call',
                params: [{
                    to: contractAddress,
                    data: data
                }, 'latest'],
                id: 1
            })
        }, 8000);
        const result = await response.json();
        const balance = parseInt(result.result, 16) / Math.pow(10, decimals);
        updateBalanceDisplay(tokenKey, balance);
        return balance;
    } catch (error) {
        console.error(`Error fetching ${tokenKey} balance:`, error);
        updateBalanceDisplay(tokenKey, 0);
        return 0;
    }
}

// Fetch SOL balance
async function fetchSOLBalance(address) {
    try {
        const response = await fetchWithTimeout(RPC_ENDPOINTS.solana, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getBalance',
                params: [address]
            })
        }, 8000);
        const data = await response.json();
        const balance = (data.result?.value || 0) / 1e9;
        updateBalanceDisplay('SOL', balance);
        return balance;
    } catch (error) {
        console.error('Error fetching SOL balance:', error);
        updateBalanceDisplay('SOL', 0);
        return 0;
    }
}

// Fetch SPL Token balance (USDT, USDC on Solana)
async function fetchSPLTokenBalance(ownerAddress, mintAddress, tokenKey) {
    try {
        const response = await fetchWithTimeout(RPC_ENDPOINTS.solana, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getTokenAccountsByOwner',
                params: [
                    ownerAddress,
                    { mint: mintAddress },
                    { encoding: 'jsonParsed' }
                ]
            })
        }, 8000);
        const data = await response.json();
        let balance = 0;
        if (data.result?.value?.length > 0) {
            const tokenAccount = data.result.value[0];
            balance = tokenAccount.account.data.parsed.info.tokenAmount.uiAmount || 0;
        }
        updateBalanceDisplay(tokenKey, balance);
        return balance;
    } catch (error) {
        console.error(`Error fetching ${tokenKey} balance:`, error);
        updateBalanceDisplay(tokenKey, 0);
        return 0;
    }
}

// Refresh balances when dropdown opens
function openWalletDropdownWithBalances() {
    openWalletDropdown();
    fetchAllBalances();
}

// =============================================
// USER ACTIVITY TRACKING
// =============================================

// Track activity - sends data to server
async function trackActivity(activityType, targetType = null, targetId = null, metadata = null, chain = null) {
    if (!window.connectedWallet?.address) return;

    try {
        const payload = {
            wallet_address: window.connectedWallet.address,
            activity_type: activityType,
            target_type: targetType,
            target_id: targetId,
            metadata: metadata ? JSON.stringify(metadata) : null,
            chain: chain || window.connectedWallet.chain
        };

        await fetch('/api/activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('Failed to track activity:', error);
    }
}

// Track wallet connection
function trackWalletConnect(chain) {
    trackActivity('wallet_connect', 'wallet', window.connectedWallet?.address, null, chain);
}

// Track wallet disconnection
function trackWalletDisconnect() {
    const address = window.connectedWallet?.address;
    const chain = window.connectedWallet?.chain;
    if (address) {
        trackActivity('wallet_disconnect', 'wallet', address, null, chain);
    }
}

// Track network switch
function trackNetworkSwitch(fromNetwork, toNetwork) {
    trackActivity('network_switch', 'network', toNetwork, {
        from_network: fromNetwork,
        to_network: toNetwork
    }, toNetwork);
}

// Track post view
function trackPostView(postSlug) {
    trackActivity('post_view', 'post', postSlug);
}

// Track post read time
function trackPostReadTime(postSlug, durationSeconds) {
    trackActivity('post_read_time', 'post', postSlug, {
        duration_seconds: durationSeconds
    });
}

// Track scroll depth
function trackScrollDepth(postSlug, percentage) {
    trackActivity('scroll_depth', 'post', postSlug, {
        percentage: percentage
    });
}

// Track link click
function trackLinkClick(url, context = null) {
    trackActivity('link_click', 'link', null, {
        url: url,
        context: context
    });
}

// Track share
function trackShare(postSlug, platform) {
    trackActivity('share', 'post', postSlug, {
        platform: platform
    });
}

// Track tip sent
function trackTipSent(postId, amount, currency, txHash) {
    trackActivity('tip_sent', 'post', postId, {
        amount: amount,
        currency: currency,
        tx_hash: txHash
    });
}

// =============================================
// AUTO TRACKING SETUP
// =============================================

// Page view tracking on post pages
function initPostTracking() {
    // Check if we're on a post page
    const postSlug = document.body.dataset.postSlug;
    if (!postSlug) return;

    let startTime = Date.now();
    let maxScrollDepth = 0;
    let hasTrackedView = false;

    // Track view when wallet is connected
    function trackViewIfConnected() {
        if (window.connectedWallet?.address && !hasTrackedView) {
            trackPostView(postSlug);
            hasTrackedView = true;
        }
    }

    // Track view immediately if already connected
    trackViewIfConnected();

    // Track view when wallet connects
    window.addEventListener('walletConnected', trackViewIfConnected);

    // Track scroll depth
    let scrollDebounce = null;
    window.addEventListener('scroll', () => {
        if (!window.connectedWallet?.address) return;

        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = Math.round((scrollTop / docHeight) * 100);

        if (scrollPercent > maxScrollDepth) {
            maxScrollDepth = scrollPercent;

            // Debounce tracking - only send at milestones (25%, 50%, 75%, 100%)
            clearTimeout(scrollDebounce);
            if (maxScrollDepth >= 25 && maxScrollDepth < 50 ||
                maxScrollDepth >= 50 && maxScrollDepth < 75 ||
                maxScrollDepth >= 75 && maxScrollDepth < 100 ||
                maxScrollDepth === 100) {
                scrollDebounce = setTimeout(() => {
                    trackScrollDepth(postSlug, maxScrollDepth);
                }, 1000);
            }
        }
    });

    // Track read time on page unload
    window.addEventListener('beforeunload', () => {
        if (window.connectedWallet?.address) {
            const durationSeconds = Math.round((Date.now() - startTime) / 1000);
            if (durationSeconds > 5) { // Only track if spent more than 5 seconds
                // Use sendBeacon for reliable unload tracking
                const payload = {
                    wallet_address: window.connectedWallet.address,
                    activity_type: 'post_read_time',
                    target_type: 'post',
                    target_id: postSlug,
                    metadata: JSON.stringify({ duration_seconds: durationSeconds }),
                    chain: window.connectedWallet.chain
                };
                navigator.sendBeacon('/api/activity', JSON.stringify(payload));
            }
        }
    });
}

// External link tracking
function initLinkTracking() {
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

        // Check if external link
        if (href.startsWith('http') && !href.includes(window.location.host)) {
            if (window.connectedWallet?.address) {
                trackLinkClick(href, link.closest('article') ? 'post_content' : 'page');
            }
        }
    });
}

// Initialize tracking when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initPostTracking();
    initLinkTracking();
});

// Modify existing functions to include tracking

// Patch authenticateWallet to track connection
const originalAuthenticateWallet = authenticateWallet;
authenticateWallet = async function(address, chain, walletType) {
    const result = await originalAuthenticateWallet(address, chain, walletType);
    // Track after successful connection
    if (window.connectedWallet?.address) {
        trackWalletConnect(chain);
    }
    return result;
};

// Patch disconnectWallet to track disconnection
const originalDisconnectWallet = disconnectWallet;
disconnectWallet = async function() {
    trackWalletDisconnect();
    return await originalDisconnectWallet();
};

// Patch switchNetwork to track network changes
const originalSwitchNetwork = switchNetwork;
switchNetwork = async function(network) {
    const previousChain = window.connectedWallet?.chain;
    await originalSwitchNetwork(network);
    // Track after successful switch
    if (window.connectedWallet?.chain === network && previousChain !== network) {
        trackNetworkSwitch(previousChain, network);
    }
};
