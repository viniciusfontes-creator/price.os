export interface HelpFeature {
  id: string;
  title: string;
  description: string;
  useCases: string[];
}

export interface PageHelpContent {
  id: string;
  title: string;
  description?: string;
  features: HelpFeature[];
}
