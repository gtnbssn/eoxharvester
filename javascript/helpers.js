import { toMercator, toWgs84 } from '@turf/projection'
import { point } from '@turf/helpers'
import { getCoord } from '@turf/invariant'

export const WGS84ToTileXY = (coordinates) => {
    const mercatorCoordinates = getCoord(toMercator(point(coordinates)));
    return{
        tileX : Math.floor((mercatorCoordinates[0] + 20037508.342789) * 0.000102208),
        tileY : Math.floor((20037508.342789 - mercatorCoordinates[1]) * 0.000102208)
    };
}

export const tileXYToWGS84 = (tileX, tileY) => {
    const mercatorLng = tileX / 0.000102208 - 20037508.342789;
    const mercatorLat = 20037508.342789 - tileY / 0.000102208;
    const coordinates = getCoord(toWgs84(point([mercatorLng, mercatorLat])));
    return{
        lng : coordinates[0],
        lat : coordinates[1]
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
