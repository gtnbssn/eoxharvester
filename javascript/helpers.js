export const mercatorToTileXY = (pt) => {
    return{
        tileX : Math.floor((pt[0] + 20037508.342789) * 0.000102208),
        tileY : Math.floor((20037508.342789 - pt[1]) * 0.000102208)
    };
}

export const tileXYToMercator = (tileX, tileY) => {
    return{
        lng: tileX / 0.000102208 - 20037508.342789,
        lat: 20037508.342789 - tileY / 0.000102208
    };
}

export const makeRectangle = (point1, point2) => {
    return(
        [[
            [Math.min(point1.lng, point2.lng), Math.max(point1.lat, point2.lat)],/*top left*/
            [Math.min(point1.lng, point2.lng), Math.min(point1.lat, point2.lat)],/*bottom left*/
            [Math.max(point1.lng, point2.lng), Math.min(point1.lat, point2.lat)],/*bottom right*/
            [Math.max(point1.lng, point2.lng), Math.max(point1.lat, point2.lat)],/*top right*/
            [Math.min(point1.lng, point2.lng), Math.max(point1.lat, point2.lat)]
        ]]
    )
}
