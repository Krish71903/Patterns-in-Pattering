import * as d3 from "d3";

export async function loadAllData() {

    const [vgHypoxia,vgLowTemp , normHypoxia, normTemp, coords] = await Promise.all([
        d3.csv("/data/Profiles_Vg_hypoxia.csv", d3.autoType),
        d3.csv("/data/Profiles_Vg_17C.csv", d3.autoType),
        d3.csv("/data/norm_vghypo-normo.csv", d3.autoType),
        d3.csv("/data/norm_curve_table_17C_25C.csv", d3.autoType),
        d3.csv("/data/coords.csv", d3.autoType),
        d3.csv("/data/mergedWingCoords.csv", d3.autoType)
    ])

    return {
    vgHypoxia,
    vgLowTemp,
    normHypoxia,
    normTemp,
    coords,
    mergedWingCoords
  };
}
