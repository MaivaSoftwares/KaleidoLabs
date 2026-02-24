
import { useState, useEffect } from "react";
import { useWallet } from "@/context/WalletContext";
import { getUserNFTs } from "@/data/nftProjects";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Image } from "lucide-react";

interface UserNFT {
  id: string;
  title: string;
  imageUrl: string;
  mintedDate: string;
}

export default function UserNFTs() {
  const { address, connected } = useWallet();
  const [userNFTs, setUserNFTs] = useState<UserNFT[]>([]);
  
  useEffect(() => {
    if (connected && address) {
      const nfts = getUserNFTs(address);
      setUserNFTs(nfts);
    } else {
      setUserNFTs([]);
    }
  }, [connected, address]);
  
  if (!connected) {
    return null;
  }
  
  return (
    <div className="mb-12 animate-fade-in">
      <Tabs defaultValue="collection">
        <TabsList>
          <TabsTrigger value="collection">My Collection</TabsTrigger>
        </TabsList>
        <TabsContent value="collection">
          {userNFTs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
              {userNFTs.map((nft) => (
                <Card key={nft.id} className="overflow-hidden border-white/10 bg-secondary/50">
                  <div className="aspect-square overflow-hidden">
                    {nft.imageUrl ? (
                      <img 
                        src={nft.imageUrl} 
                        alt={nft.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = "https://images.unsplash.com/photo-1580927752452-89d86da3fa0a?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxzZWFyY2h8Mnx8Y3J5cHRvfGVufDB8fDB8fA%3D%3D&auto=format&fit=crop&w=800&q=60";
                        }} 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <Image className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold">{nft.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      Minted on {new Date(nft.mintedDate).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 mt-6 border rounded-md border-dashed border-white/10">
              <h3 className="text-lg font-medium">No NFTs in your collection yet</h3>
              <p className="text-muted-foreground mt-2">Mint from the featured projects to start your collection.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
