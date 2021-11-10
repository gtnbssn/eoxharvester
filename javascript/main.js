import * as mapboxgl from 'mapbox-gl'
import { toMercator, toWgs84 } from '@turf/projection'
import { point } from '@turf/helpers'
import { getCoord } from '@turf/invariant'
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';

import { mercatorToTileXY, tileXYToMercator, makeRectangle } from './helpers.js'

import '../assets/style.css'
import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';

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
let harvestedTilesCoordinates = [];
let harvestedTilesGeoJSON = {
    'type': 'MultiPolygon',
    'coordinates' : harvestedTilesCoordinates
};
let map = new mapboxgl.Map({
    accessToken: 'pk.eyJ1IjoiZ3RuYnNzbiIsImEiOiJja3Z0cGhnMHgzZXk4Mm50a3Qwb3JvejBvIn0.9xnSTugMVAagxRx7imaL-Q',
    container: 'map', // container id
    style: {
        'version': 8,
        'sources': {
            'EOX-cloudless': {
                'type': 'raster',
                'tiles': [
                    'https://a.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
                    'https://b.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
                    'https://c.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
                    'https://d.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
                    'https://e.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
                    'https://f.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
                    'https://g.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
                    'https://h.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg'
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
            'harvestedTiles': {
                'type': 'geojson',
                'data': harvestedTilesGeoJSON
            },
        },
        'layers': [
        {
            'id': 'cloudless2020',
            'type': 'raster',
            'source': 'EOX-cloudless'
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
            'id': 'harvestedTiles',
            'type': 'fill',
            'source': 'harvestedTiles',
            'layout': {},
            'paint': {
                'fill-color': '#EEE',
                'fill-opacity': 0.4
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
    hash: true,
    minZoom: 0,
    maxZoom: 18,
    antialias: true
});

mapboxgl.accessToken = 'pk.eyJ1IjoiZ3RuYnNzbiIsImEiOiJja3Z0cGhnMHgzZXk4Mm50a3Qwb3JvejBvIn0.9xnSTugMVAagxRx7imaL-Q';
const geocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    zoom: 12
})
map.addControl(geocoder,'top-left');

const nav = new mapboxgl.NavigationControl();
map.addControl(nav, 'top-left');
const scale = new mapboxgl.ScaleControl();
map.addControl(scale);

const setZoomButton = document.getElementById('setZoom');
const resetPitchAndBearingButton = document.getElementById('resetPitchAndBearing');
const currentTileCoordinatesDiv = document.getElementById('currentTileCoordinates');
const currentCoordinatesDiv = document.getElementById('currentCoordinates');
const harvestInfoDiv = document.getElementById('harvestInfo');
const triggerHarvestButton = document.getElementById('triggerHarvest');
const cancelHarvestButton = document.getElementById('cancelHarvest');
const tagSelector = document.getElementById('tags');
const contentListUL = document.getElementById("contentList");
const updateCountButton = document.getElementById('updateCount');

let selectionBoundsXYtiles = [];
let selectedTag = "other";

setZoomButton.addEventListener('click', (e) => {map.setZoom(12)});
resetPitchAndBearingButton.addEventListener('click', (e) => {
    map.setPitch(0);
    map.setBearing(0);
});
tagSelector.addEventListener('change', (e) => {
    selectedTag = e.target.value;
});

const harvest = (topLeftTileX, topLeftTileY, bottomRightTileX, bottomRightTileY) => {
    for (let i = topLeftTileX; i < bottomRightTileX; i = i + 2){
        for (let j = topLeftTileY; j < bottomRightTileY; j = j + 2){
            fetch('https://europe-west3-eoxharvest-7953f.cloudfunctions.net/harvester',
            //fetch('https://europe-west3-eoxharvest-7953f.cloudfunctions.net/dummyharvester',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({tileX: i, tileY: j, tag: selectedTag})
                }
            ).then(
                (res) => {return res.text();}
            ).then(
                (result) => {
                    //make rectangle and append it to the coordinates array
                    const topLeft = tileXYToMercator(i, j);
                    const coordsTopLeft = getCoord(toWgs84(point([topLeft.lng, topLeft.lat])));
                    const point1 = {lng: coordsTopLeft[0], lat: coordsTopLeft[1]};
                    const bottomRight = tileXYToMercator(i+2, j+2);
                    const coordsBottomRight = getCoord(toWgs84(point([bottomRight.lng, bottomRight.lat])));
                    const point2 = {lng: coordsBottomRight[0], lat: coordsBottomRight[1]};
                    harvestedTilesCoordinates.push(makeRectangle(point1, point2));
                    harvestedTilesGeoJSON.coordinates = harvestedTilesCoordinates;
                    map.getSource('harvestedTiles').setData(harvestedTilesGeoJSON);
                    console.log(result);
                }
            );
        }
    }
    clearSelection();
};

const updateTotalPerCategory = () => {
    fetch('https://europe-west3-eoxharvest-7953f.cloudfunctions.net/countContentPerTag')
    .then((res) => {return res.json();}
    ).then(
        (json) => {
            contentListUL.innerHTML = "";
            Object.entries(json).map(([key,value]) => {
                contentListUL.appendChild(document.createElement("li")).innerHTML = key + ": " + value;
            })
        }
    );
}

export const clearSelection = () => {
    selectionBoundsXYtiles = [];
    selectionTilesGeoJSON.geometry.coordinates = [];
    map.getSource('selectionTiles').setData(selectionTilesGeoJSON);
    harvestInfoDiv.innerHTML = "";
}

updateCountButton.addEventListener('click', (e) => updateTotalPerCategory());

document.addEventListener("DOMContentLoaded", updateTotalPerCategory);

triggerHarvestButton.addEventListener('click', (e) => {harvest(...selectionBoundsXYtiles)});

cancelHarvestButton.addEventListener('click', (e) => clearSelection());

const updateOnMouseMove = (e) => {
    const converted = toMercator(point([e.lngLat.lng,e.lngLat.lat]));
    if(anchor){
        rectangle = makeRectangle(e.lngLat, anchor);
        selectionGeoJSON.geometry.coordinates = rectangle;
        map.getSource('selection').setData(selectionGeoJSON);
    }
    currentTileCoordinatesDiv.innerHTML = JSON.stringify(mercatorToTileXY(converted.geometry.coordinates));
    currentCoordinatesDiv.innerHTML = JSON.stringify(e.lngLat.wrap());
};

map.on('mousemove', updateOnMouseMove);

map.on('click', (e) => {
    if(!anchor){
        anchor = e.lngLat;
    }else{
        // mark the actual area to harvest, we want an even number of tiles on both axis
        // get the tile positions from the coordinates of our rectangle
        let {tileX: topLeftTileX, tileY: topLeftTileY} = mercatorToTileXY(toMercator(point(rectangle[0][0])).geometry.coordinates);
        let {tileX: bottomRightTileX, tileY: bottomRightTileY} = mercatorToTileXY(toMercator(point(rectangle[0][2])).geometry.coordinates);
        // if we have selected only 1 tile in one of the directions, make it 2
        if(topLeftTileX == bottomRightTileX){bottomRightTileX = bottomRightTileX + 1};
        if(topLeftTileY == bottomRightTileY){bottomRightTileY = bottomRightTileY + 1};
        // because the coordinates are the top left corner of a tile, we want to add 1 to the bottom right corner on top of other adjustments
        // if the number of tiles in one of the directions is odd, add 2 tiles in this direction
        // if the number is even, only add one tile, to include the bottom right tile
        // the number of tiles is EVEN when top left - bottom right is ODD
        // 10 - 8 = 2, means we have tiles 10, 9 and 8
        if((topLeftTileX - bottomRightTileX) % 2 == 0){bottomRightTileX = bottomRightTileX + 2}else{bottomRightTileX = bottomRightTileX + 1};
        if((topLeftTileY - bottomRightTileY) % 2 == 0){bottomRightTileY = bottomRightTileY + 2}else{bottomRightTileY = bottomRightTileY + 1};
        // constrain the selection to a 12x12 square
        // we should harvest a maximum of 144 tiles per query (36 1024x1024 tiles)
        // this is to avoid overloading the EOX server
        if((bottomRightTileX - topLeftTileX )>12){ bottomRightTileX = topLeftTileX + 12 };
        if((bottomRightTileY - topLeftTileY )>12){ bottomRightTileY = topLeftTileY + 12 };
        selectionBoundsXYtiles = [topLeftTileX, topLeftTileY, bottomRightTileX, bottomRightTileY];
        const {lng: topLeftTileLng, lat: topLeftTileLat} = tileXYToMercator(topLeftTileX, topLeftTileY);
        const coords1 = getCoord(toWgs84(point([topLeftTileLng, topLeftTileLat])));
        const point1 = {lng: coords1[0], lat: coords1[1]};
        const {lng: bottomRightTileLng, lat: bottomRightTileLat} = tileXYToMercator(bottomRightTileX, bottomRightTileY);
        const coords2 = getCoord(toWgs84(point([bottomRightTileLng, bottomRightTileLat])));
        const point2 = {lng: coords2[0], lat: coords2[1]};
        const tilesRectangle = makeRectangle(point1, point2);
        selectionTilesGeoJSON.geometry.coordinates = tilesRectangle;
        map.getSource('selectionTiles').setData(selectionTilesGeoJSON);
        // iterate over the selection, skipping a tile in each direction and call the api for each
        harvestInfoDiv.innerHTML = "selection: " + ((bottomRightTileX -topLeftTileX) * (bottomRightTileY - topLeftTileY)) / 4 + " 1024 x 1024 tiles";
        // clear the selection
        rectangle = [];
        selectionGeoJSON.geometry.coordinates = rectangle;
        map.getSource('selection').setData(selectionGeoJSON);
        anchor = null;
    }
});
