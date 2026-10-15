export type DomainDay = { date:string; host:string; requests:number; visits:number; bytes:number };
export type MetricsFeed = {
  generatedAt:string; from:string; to:string; timeZone:'UTC';
  domains:DomainDay[]; zoneVisitors:{date:string;requests:number;uniqueIPs:number}[];
  downloadDays:{date:string;requests:number;bytes:number}[];
  files:{date:string;path:string;slug:string;requests:number;bytes:number}[];
  filesTruncated:boolean;
  workEvents?:{date:string;slug:string;views:number;downloadClicks:number}[];
  workEventsAvailable?:boolean;
};
