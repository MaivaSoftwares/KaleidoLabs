import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { mintNFT } from "@/data/nftProjects";
import { toast } from "@/components/ui/sonner";
import { NFTProject } from "@/data/nftProjects";
import { Check, Image } from "lucide-react";

export default function NFTProjectCard({ project }: { project: NFTProject }) {
  const [minting, setMinting] = useState(false);
  const [minted, setMinted] = useState(false);
  const { connected, address } = useWallet();
  
  const handleMint = async () => {
    if (!connected) {
      toast("Please connect your wallet first");
      return;
    }
    
    try {
      setMinting(true);
      const success = await mintNFT(project.id, address);
      
      if (success) {
        setMinted(true);
        toast("NFT minted successfully!", {
          description: `You've minted ${project.title}`,
        });
      } else {
        toast("Minting failed", {
          description: "Please try again",
        });
      }
    } catch (error) {
      console.error("Error minting NFT:", error);
      toast("Minting failed", {
        description: "Please try again",
      });
    } finally {
      setMinting(false);
    }
  };
  
  // Format the mint date
  const formatMintDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Get badge styling based on status
  const getStatusBadge = () => {
    switch (project.status) {
      case 'live':
        return <Badge className="bg-neon-green text-black animate-pulse-glow">Live</Badge>;
      case 'upcoming':
        return <Badge variant="secondary">Upcoming</Badge>;
      case 'ended':
        return <Badge variant="outline">Ended</Badge>;
      default:
        return null;
    }
  };
  
  return (
    <Card className="overflow-hidden card-hover border-white/10 bg-secondary/50">
      <div className="aspect-square overflow-hidden relative">
        {project.imageUrl ? (
          <img 
            src={project.imageUrl} 
            alt={project.title}
            className="w-full h-full object-cover transition-all duration-500 hover:scale-105"
            onError={(e) => {
              // Fallback if image doesn't load
              e.currentTarget.src = "https://images.unsplash.com/photo-1580927752452-89d86da3fa0a?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxzZWFyY2h8Mnx8Y3J5cHRvfGVufDB8fDB8fA%3D%3D&auto=format&fit=crop&w=800&q=60";
            }} 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Image className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        <div className="absolute top-2 right-2">
          {getStatusBadge()}
        </div>
      </div>
      
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle>{project.title}</CardTitle>
        </div>
        <CardDescription>{project.artist}</CardDescription>
      </CardHeader>
      
      <CardContent className="pb-4">
        <p className="text-sm text-muted-foreground line-clamp-2 h-10">
          {project.description}
        </p>
        <div className="flex justify-between mt-4 text-sm">
          <div>
            <p className="text-muted-foreground">Price</p>
            <p className="font-semibold">{project.price}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Available</p>
            <p className="font-semibold">{project.remaining}/{project.totalSupply}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Date</p>
            <p className="font-semibold">{formatMintDate(project.mintDate)}</p>
          </div>
        </div>
      </CardContent>
      
      <CardFooter>
        <Button 
          className="w-full" 
          onClick={handleMint}
          disabled={minting || project.status !== 'live' || project.remaining === 0 || minted}
        >
          {minting ? (
            <>Minting<span className="animate-pulse">...</span></>
          ) : minted ? (
            <><Check className="mr-2 h-4 w-4" />Minted</>
          ) : project.status === 'upcoming' ? (
            'Coming Soon'
          ) : project.status === 'ended' ? (
            'Sold Out'
          ) : project.remaining === 0 ? (
            'Sold Out'
          ) : (
            'Mint Now'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
