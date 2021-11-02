import * as mapboxgl from 'mapbox-gl'
import { toMercator, toWgs84 } from '@turf/projection'
import { point } from '@turf/helpers'
import { getCoord } from '@turf/invariant'

import { mercatorToTileXY, tileXYToMercator, makeRectangle } from './helpers.js'

import '../assets/style.css'
import 'mapbox-gl/dist/mapbox-gl.css'

let anchor = null;
let rectangle = null;
let selectionGeoJSON = {
    'type': 'Feature',
    'geometry': {
        'type': 'Polygon',
        'coordinates': []
    }
};
let selectionTilesGeoJSON = {
    'type': 'Feature',
    'geometry': {
        'type': 'Polygon',
        'coordinates': []
    }
};
let map = new mapboxgl.Map({
    container: 'map', // container id
    style: {
        'version': 8,
        'sources': {
            'EOX-cloudless': {
                'type': 'raster',
                'tiles': [
                    'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg'
                ],
                'tileSize': 256,
                'attribution':
                '<a xmlns:cc="http://creativecommons.org/ns#" href="https://eox.at" property="cc:attributionName" rel="cc:attributionURL">EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data 2020) released under <a rel="license" href="https://creativecommons.org/licenses/by-nc-sa/4.0/">Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License</a>. For commercial usage please see <a href="https://cloudless.eox.at">https://cloudless.eox.at</a>'
            },
            'selection': {
                'type': 'geojson',
                'data': selectionGeoJSON
            },
            'redLine': {
                'type': 'geojson',
                'data': {
                    'type': 'Feature',
                    'properties': {},
                    'geometry': {
                        'type': 'LineString',
                        'coordinates': [
                            [-180, -90],
                            [-180, 90]
                        ]
                    }
                }
            },
            'selectionTiles': {
                'type': 'geojson',
                'data': selectionTilesGeoJSON
            },
        },
        'layers': [
        {
            'id': 'cloudless2020',
            'type': 'raster',
            'source': 'EOX-cloudless',
            'minzoom': 0,
            'maxzoom': 18
        },
        {
            'id': 'selection',
            'type': 'fill',
            'source': 'selection',
            'layout': {},
            'paint': {
                'fill-color': '#055',
                'fill-opacity': 0.8
                }
        },
        {
            'id': 'selectionTiles',
            'type': 'fill',
            'source': 'selectionTiles',
            'layout': {},
            'paint': {
                'fill-color': '#0EE',
                'fill-opacity': 0.8
                }
        },
        {
            'id': 'redLine',
            'type': 'line',
            'source': 'redLine',
            'layout': {},
            'paint': {
                'line-color': '#F00',
                'line-width': 5
                }
        }
        ]
    },
    center: [-80.5, 7.5], // starting position
    zoom: 12, // starting zoom
    hash: true
});
let nav = new mapboxgl.NavigationControl();
map.addControl(nav, 'top-left');
let scale = new mapboxgl.ScaleControl();
map.addControl(scale);

map.on('mousemove', (e) => {
    const converted = toMercator(point([e.lngLat.lng,e.lngLat.lat]));
    if(anchor){
        rectangle = makeRectangle(e.lngLat, anchor);
        selectionGeoJSON.geometry.coordinates = rectangle;
        map.getSource('selection').setData(selectionGeoJSON);
    }
    document.getElementById('info').innerHTML =
    JSON.stringify(mercatorToTileXY(converted.geometry.coordinates)) +
    '<br/>' +
    // e.lngLat is the longitude, latitude geographical position of the event
    JSON.stringify(e.lngLat.wrap()) +
    '<br/>' +
    anchor
    '<br/>' +
    rectangle;
});

map.on('click', (e) => {
    if(!anchor){
        anchor = e.lngLat;
    }else{
        // mark the actual area to harvest, even tiles only
        let {tileX: topLeftTileX, tileY: topLeftTileY} = mercatorToTileXY(toMercator(point(rectangle[0][0])).geometry.coordinates);
        let {tileX: bottomRightTileX, tileY: bottomRightTileY} = mercatorToTileXY(toMercator(point(rectangle[0][2])).geometry.coordinates);
        if(topLeftTileX == bottomRightTileX){bottomRightTileX = bottomRightTileX + 1};
        if(topLeftTileY == bottomRightTileY){bottomRightTileY = bottomRightTileY + 1};
        if(topLeftTileX % 2 == 1){topLeftTileX = topLeftTileX - 1};
        if(topLeftTileY % 2 == 1){topLeftTileY = topLeftTileY - 1};
        if(bottomRightTileX % 2 == 1){bottomRightTileX = bottomRightTileX + 1}else{bottomRightTileX = bottomRightTileX + 2};
        if(bottomRightTileY % 2 == 1){bottomRightTileY = bottomRightTileY + 1}else{bottomRightTileY = bottomRightTileY + 2};
        const {lng: topLeftTileLng, lat: topLeftTileLat} = tileXYToMercator(topLeftTileX, topLeftTileY);
        const coords1 = getCoord(toWgs84(point([topLeftTileLng, topLeftTileLat])));
        const point1 = {lng: coords1[0], lat: coords1[1]};
        const {lng: bottomRightTileLng, lat: bottomRightTileLat} = tileXYToMercator(bottomRightTileX, bottomRightTileY);
        const coords2 = getCoord(toWgs84(point([bottomRightTileLng, bottomRightTileLat])));
        const point2 = {lng: coords2[0], lat: coords2[1]};
        const tilesRectangle = makeRectangle(point1, point2);
        selectionTilesGeoJSON.geometry.coordinates = tilesRectangle;
        map.getSource('selectionTiles').setData(selectionTilesGeoJSON);
        console.log("harvest " + ((bottomRightTileX -topLeftTileX) * (bottomRightTileY - topLeftTileY ) / 4)  + " tiles");
        // TODO call the harvest API
        // clear the selection
        rectangle = [];
        selectionGeoJSON.geometry.coordinates = rectangle;
        map.getSource('selection').setData(selectionGeoJSON);
        anchor = null;
    }
});
