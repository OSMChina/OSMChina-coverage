import Papa from 'papaparse';

export async function loadAllCsvPoints() {
    // 1. Load file list
    const filesRes = await fetch(
        '/provinceList.json'
    );
    const provinces = await filesRes.json();

    // 2. Fetch & parse each CSV
    const allPoints = [];

    const requests = provinces.map(async province => {
        const res = await fetch(
            `/data/China_Report_2025/data/feature_comprehensiveness_statistics_${province}.csv`
        );

        const csvText = await res.text();

        const parsed = Papa.parse(csvText, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
        });

        return parsed.data
            .filter(row => row.lon && row.lat && row.score !== undefined)
            .map(row => ({
                lon: row.lon,
                lat: row.lat,
                score: row.score,
                addr1: row.addr_1,
                addr2: row.addr_2,
                addr3: row.addr_3,
                addr4: row.addr_4,
                boundary: row.boundary,
                node: row.node,
            }));
    });

    // Wait for all CSVs
    const results = await Promise.all(requests);

    // Flatten into one array
    results.flat().forEach(p => allPoints.push(p));

    return allPoints;
}
