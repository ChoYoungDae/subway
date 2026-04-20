export interface Station {
    id: string;
    nameEn: string;
    nameKo: string;
    lines: string[];
}

export interface Route {
    id: string;
    from: string;
    to: string;
    descriptionEn?: string;
    descriptionKo?: string;
    steps: any[];
}

export interface Exit {
    id: string;
    exitNo: string;
    stationId: string;
    nameEn?: string;
    nameKo?: string;
}
