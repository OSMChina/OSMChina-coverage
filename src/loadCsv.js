import Papa from 'papaparse';

const base = import.meta.env.BASE_URL;

export async function loadAllCsvPoints() {
    // 1. Load file list
    const filesRes = await fetch(
        `${base}provinceList.json`
    );
    const provinces = await filesRes.json();

    // 2. Fetch & parse each CSV
    const allPoints = [];

    const requests = provinces.map(async province => {
        const res = await fetch(
            `${base}data/China_Report_2025/data/feature_comprehensiveness_statistics_${province}.csv`
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
                n_place_1km: row.places_total_1km,
                n_place_3km: row.places_total_3km,

                n_road_tru_3km: row.road_trunk_3km,
                n_road_pri_3km: row.road_primary_3km,
                n_road_sec_3km: row.road_secondary_3km,
                n_road_ter_3km: row.road_tertiary_3km,
                n_road_res_3km: row.road_res_uncl_3km,
                n_bus_3km: row.road_bus_stop_3km,
                n_prk_3km: row.road_parking_3km,
                n_ful_3km: row.road_fuel_3km,
                n_road_typ_3km: row.road_types_3km,
                n_road_tru_1km: row.road_trunk_1km,
                n_road_pri_1km: row.road_primary_1km,
                n_road_sec_1km: row.road_secondary_1km,
                n_road_ter_1km: row.road_tertiary_1km,
                n_road_res_1km: row.road_res_uncl_1km,
                n_bus_1km: row.road_bus_stop_1km,
                n_prk_1km: row.road_parking_1km,
                n_ful_1km: row.road_fuel_1km,
                n_road_typ_1km: row.road_types_1km,

                n_gov_3km: row.amenity_gov_3km,
                n_hlt_3km: row.amenity_health_3km,
                n_sch_3km: row.amenity_school_3km,
                n_plc_3km: row.amenity_police_3km,
                n_pst_3km: row.amenity_post_3km,
                n_bnk_3km: row.amenity_bank_3km,
                n_shp_3km: row.amenity_shop_3km,

                n_gov_1km: row.amenity_gov_1km,
                n_hlt_1km: row.amenity_health_1km,
                n_sch_1km: row.amenity_school_1km,
                n_plc_1km: row.amenity_police_1km,
                n_pst_1km: row.amenity_post_1km,
                n_bnk_1km: row.amenity_bank_1km,
                n_shp_1km: row.amenity_shop_1km,

                n_bul_3km: row.buildings_total_3km,
                n_land_typ_3km: row.landuse_types_3km,
                n_bul_1km: row.buildings_total_1km,
                n_land_typ_1km: row.landuse_types_1km,

                score_1: row.score_1,
                score_2: row.score_2,
                score_3: row.score_3,
                score_4: row.score_4,
            }));
    });

    // Wait for all CSVs
    const results = await Promise.all(requests);

    // Flatten into one array
    results.flat().forEach(p => allPoints.push(p));

    return allPoints;
}

export async function normalizeAddresses(points) {

    const badAddr2 = new Set([
        "市辖区",
        "市辖县",
    ]);

    const nanAddr2 = new Set([
        "省直辖县级行政区划",
    ]);

    points.forEach(p => {
        if (p.addr2) {
            if (badAddr2.has(p.addr2.trim())) {
                p.addr2 = p.addr1;
            } else if (nanAddr2.has(p.addr2.trim())) {
                p.addr2 = "";
            }
        }
        if (p.addr2 == p.addr3) {
            p.addr3 = "";
        }
        if (p.addr3 == p.addr4) {
            p.addr4 = "";
        }
    });
}
