export interface OSRSItem {
  id: number;
  name: string;
  examine: string;
  members: boolean;
  lowalch?: number;
  highalch?: number;
  weight?: number;
  buy_limit?: number;
  quest_item?: boolean;
  release_date?: string;
  wiki_name?: string;
  wiki_url?: string;
}

export type WikiItemMapping = Record<string, OSRSItem>;

export interface WikiPriceData {
  high: number;
  highTime: number;
  low: number;
  lowTime: number;
}

export interface WikiPriceResponse {
  data: Record<string, WikiPriceData>;
}

export interface WikiLatestResponse {
  data: Record<string, WikiPriceData>;
}

export interface WikiTimedResponse {
  data: {
    timestamp: number;
    avgHighPrice: number;
    avgLowPrice: number;
    highPriceVolume: number;
    lowPriceVolume: number;
  }[];
}

export type WikiMappingResponse = OSRSItem[]; 