import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Base URL for metadata and assets
const BASE_URL = process.env.BASE_URL || 'https://launchpad.kaleidofinance.xyz';

// Metadata structure following OpenSea standard
interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  animation_url?: string;
  external_url?: string;
  background_color?: string;
  properties?: {
    files?: Array<{
      uri: string;
      type: string;
    }>;
  };
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

// Generate random attributes for the NFT
function generateAttributes(tokenId: string) {
  // These are example attributes - customize based on your NFT theme
  const rarity = Math.random() < 0.1 ? 'Legendary' : 
               Math.random() < 0.3 ? 'Rare' : 'Common';
  
  const level = Math.floor(Math.random() * 100) + 1;
  
  const nodeType = ['Validator', 'Storage', 'Compute', 'Gateway'][Math.floor(Math.random() * 4)];
  
  return [
    {
      trait_type: 'Rarity',
      value: rarity
    },
    {
      trait_type: 'Level',
      value: level
    },
    {
      trait_type: 'Node Type',
      value: nodeType
    },
    {
      trait_type: 'Generation',
      value: 1
    }
  ];
}

// Get the image URL for the NFT
// We're using a single GIF image for all NFTs that already exists in the public directory
function getImageUrl(tokenId: string): string {
  // Generate a unique image URL for each NFT
  return `${BASE_URL}/api/nft/metadata/${tokenId}/image`;
}

// Get the animation URL for the NFT (for wallets that support it)
function getAnimationUrl(tokenId: string): string {
  // Use the existing MP4 in the public directory
  // This assumes you have an MP4 named 'nft.mp4' in your public directory
  return `${BASE_URL}/nft.mp4`;
}

export async function generateMetadata(tokenId: string, ownerAddress: string): Promise<NFTMetadata> {
  // Get the image URL for this NFT
  const imageUrl = getImageUrl(tokenId);
  // Get the animation URL for this NFT
  const animationUrl = getAnimationUrl(tokenId);
  
  // Create metadata following OpenSea standard
  const metadata: NFTMetadata = {
    name: `Kaleido Super Node #${tokenId}`,
    description: `A powerful node in the Kaleido network. Owned by ${ownerAddress.substring(0, 6)}...${ownerAddress.substring(ownerAddress.length - 4)}`,
    image: `${BASE_URL}/nft.gif`,
    external_url: `${BASE_URL}/nft/${tokenId}`,
    attributes: generateAttributes(tokenId),
    background_color: "000000",
    animation_url: `${BASE_URL}/nft.mp4`,
    properties: {
      files: [
        {
          uri: `${BASE_URL}/nft.gif`,
          type: "image/gif"
        }
      ]
    }
  };
  
  // Save metadata to a JSON file
  const metadataDir = path.join(__dirname, '../../public/metadata');
  if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir, { recursive: true });
  }
  
  const metadataPath = path.join(metadataDir, `${tokenId}.json`);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  
  return metadata;
}

// Endpoint to serve metadata
export function getMetadataEndpoint(tokenId: string): string {
  return `${BASE_URL}/api/nft/metadata/${tokenId}`;
}

// Endpoint to serve image
export function getImageEndpoint(tokenId: string): string {
  return `${BASE_URL}/api/nft/metadata/${tokenId}/image`;
}

// Endpoint to serve animation
export function getAnimationEndpoint(tokenId: string): string {
  return `${BASE_URL}/api/nft/metadata/${tokenId}/animation`;
}

export default {
  generateMetadata,
  getMetadataEndpoint
};
