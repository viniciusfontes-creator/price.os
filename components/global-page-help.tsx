"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, ChevronRight, Lightbulb, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { pageHelpData } from "@/lib/page-help-data";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function GlobalPageHelp() {
  const pathname = usePathname();
  
  // Find content for current path, fallback to a generic one or don't render if there's none.
  // For now, if no exact match, we can try to match the base path or return null.
  // However, since the user wants it on ALL pages, if we don't have it mapped, we could show a default "Em construção" or just not render.
  const content = pageHelpData[pathname] || pageHelpData["/dashboard"]; // Using dashboard as fallback temporarily for unmapped pages if needed. Or better: return null. Let's return null to avoid confusion on unknown pages, but the user requested on all pages, so let's render it if possible.

  const [activeFeatureId, setActiveFeatureId] = useState<string | null>(null);

  useEffect(() => {
    // Reset active feature when path or content changes
    if (content?.features?.length > 0) {
      setActiveFeatureId(content.features[0].id);
    }
  }, [content]);

  if (!pageHelpData[pathname]) {
    // If you want it visible everywhere even without content, you could uncomment the above and use a generic fallback.
    // For now, I only render if mapped. The user can map more in lib/page-help-data.ts
    // Let's actually provide a generic one so it fulfills "all pages".
  }

  const activeContent = content;
  if (!activeContent) return null;

  const activeFeature = activeContent.features.find((f) => f.id === activeFeatureId);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg bg-background hover:bg-muted border-primary/20 z-50 group hover:shadow-xl transition-all"
        >
          <HelpCircle className="h-6 w-6 text-primary group-hover:scale-110 transition-transform" />
          <span className="sr-only">Ajuda da página</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[85vh] p-0 overflow-hidden flex flex-col gap-0 border-none shadow-2xl">
        <div className="p-6 border-b bg-muted/20">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <HelpCircle className="h-6 w-6 text-primary" />
              {activeContent.title}
            </DialogTitle>
            {activeContent.description && (
              <DialogDescription className="text-base mt-2">
                {activeContent.description}
              </DialogDescription>
            )}
          </DialogHeader>
        </div>

        <div className="flex flex-1 overflow-hidden bg-background">
          {/* Sidebar */}
          <div className="w-1/3 border-r bg-muted/10">
            <ScrollArea className="h-[500px] w-full">
              <div className="p-4 space-y-1">
                {activeContent.features.map((feature, idx) => {
                  const isActive = activeFeatureId === feature.id;
                  return (
                    <button
                      key={feature.id}
                      onClick={() => setActiveFeatureId(feature.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-lg flex items-center justify-between transition-all duration-200",
                        isActive
                          ? "bg-primary text-primary-foreground font-medium shadow-sm"
                          : "hover:bg-muted font-medium text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "flex items-center justify-center w-6 h-6 rounded-full text-xs shrink-0",
                          isActive ? "bg-primary-foreground/20" : "bg-muted-foreground/20"
                        )}>
                          {idx + 1}
                        </span>
                        <span className="line-clamp-2">{feature.title}</span>
                      </div>
                      <ChevronRight className={cn(
                        "h-4 w-4 shrink-0 transition-transform ml-2",
                        isActive ? "opacity-100 translate-x-1" : "opacity-0"
                      )} />
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Main Content Area */}
          <div className="w-2/3 p-6">
            <ScrollArea className="h-[500px] w-full pr-4">
              {activeFeature && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <h3 className="text-2xl font-semibold mb-4 text-foreground flex items-center gap-2">
                      {activeFeature.title}
                    </h3>
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-muted-foreground text-base leading-relaxed">
                      {activeFeature.description}
                    </div>
                  </div>
                  
                  {activeFeature.useCases && activeFeature.useCases.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="flex items-center gap-2 text-lg font-medium text-foreground">
                        <Lightbulb className="h-5 w-5 text-amber-500" />
                        Casos de Uso Práticos
                      </h4>
                      <div className="grid gap-3">
                        {activeFeature.useCases.map((useCase, idx) => (
                          <div 
                            key={idx} 
                            className="flex items-start gap-3 p-4 rounded-lg bg-card border shadow-sm transition-all hover:shadow-md"
                          >
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" />
                            <p className="text-sm text-foreground/90 leading-normal">
                              {useCase}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
