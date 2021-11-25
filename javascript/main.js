import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';

import { tileXYToWGS84, WGS84ToTileXY, makeRectangle } from './helpers.js';

import '../assets/style.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';

const accessToken =
    'pk.eyJ1IjoiZ3RuYnNzbiIsImEiOiJja3Z0cGhnMHgzZXk4Mm50a3Qwb3JvejBvIn0.9xnSTugMVAagxRx7imaL-Q';
let anchor = null;
let rectangle = null;
let selectionBoundsXYtiles = [];
let selectionExists = false;

const currentTileCoordinatesDiv = document.getElementById(
    'currentTileCoordinates'
);
const currentCoordinatesDiv = document.getElementById('currentCoordinates');
const harvestInfoDiv = document.getElementById('harvestInfo');
const tagSelector = document.getElementById('tags');
const tagWarning = document.getElementById('tagWarning');
const contentListUL = document.getElementById('contentList');

let selectionGeoJSON = {
    type: 'Feature',
    geometry: {
        type: 'Polygon',
        coordinates: [],
    },
};
let selectionTilesGeoJSON = {
    type: 'Feature',
    geometry: {
        type: 'Polygon',
        coordinates: [],
    },
};
let harvestedTilesCoordinates = [];
let harvestedTilesGeoJSON = {
    type: 'MultiPolygon',
    coordinates: harvestedTilesCoordinates,
};

const map = new mapboxgl.Map({
    accessToken: accessToken,
    container: 'map',
    center: [-80.5, 7.5],
    zoom: 12,
    hash: true,
    minZoom: 0,
    maxZoom: 14,
    maxPitch: 85,
    antialias: true,
    style: {
        version: 8,
        sources: {
            'EOX-cloudless': {
                type: 'raster',
                tiles: [
                    'https://a.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
                    'https://b.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
                    'https://c.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
                    'https://d.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
                    'https://e.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
                    'https://f.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
                    'https://g.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
                    'https://h.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
                ],
                tileSize: 256,
                attribution:
                    '<a xmlns:cc="http://creativecommons.org/ns#" href="https://eox.at" property="cc:attributionName" rel="cc:attributionURL">EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data 2020) released under <a rel="license" href="https://creativecommons.org/licenses/by-nc-sa/4.0/">Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License</a>. For commercial usage please see <a href="https://cloudless.eox.at">https://cloudless.eox.at</a>',
            },
            'mapbox-dem': {
                type: 'raster-dem',
                url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
                tileSize: 512,
                maxzoom: 14,
            },
            selection: {
                type: 'geojson',
                data: selectionGeoJSON,
            },
            redLine: {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [-180, -90],
                            [-180, 90],
                        ],
                    },
                },
            },
            selectionTiles: {
                type: 'geojson',
                data: selectionTilesGeoJSON,
            },
            harvestedTiles: {
                type: 'geojson',
                data: harvestedTilesGeoJSON,
            },
        },
        layers: [
            {
                id: 'cloudless2020',
                type: 'raster',
                source: 'EOX-cloudless',
            },
            {
                id: 'selection',
                type: 'fill',
                source: 'selection',
                layout: {},
                paint: {
                    'fill-color': '#055',
                    'fill-opacity': 0.8,
                },
            },
            {
                id: 'selectionTiles',
                type: 'fill',
                source: 'selectionTiles',
                layout: {},
                paint: {
                    'fill-color': '#0EE',
                    'fill-opacity': 0.8,
                },
            },
            {
                id: 'harvestedTiles',
                type: 'fill',
                source: 'harvestedTiles',
                layout: {},
                paint: {
                    'fill-color': '#EEE',
                    'fill-opacity': 0.4,
                },
            },
            {
                id: 'redLine',
                type: 'line',
                source: 'redLine',
                layout: {},
                paint: {
                    'line-color': '#F00',
                    'line-width': 5,
                },
            },
            {
                id: 'sky',
                type: 'sky',
                paint: {
                    'sky-type': 'atmosphere',
                    'sky-atmosphere-sun': [0.0, 0.0],
                    'sky-atmosphere-sun-intensity': 15,
                },
            },
        ],
        terrain: { source: 'mapbox-dem', exaggeration: 1.5 },
    },
});
const geocoder = new MapboxGeocoder({
    accessToken: accessToken,
    mapboxgl: mapboxgl,
    zoom: 12,
});
map.addControl(geocoder, 'top-left');

const nav = new mapboxgl.NavigationControl();
map.addControl(nav, 'top-left');
const scale = new mapboxgl.ScaleControl();
map.addControl(scale);

const harvest = (selectionBoundsXYtiles) => {
    const [topLeftTileX, topLeftTileY, bottomRightTileX, bottomRightTileY] =
        selectionBoundsXYtiles;
    for (let i = topLeftTileX; i < bottomRightTileX; i = i + 2) {
        for (let j = topLeftTileY; j < bottomRightTileY; j = j + 2) {
            //fetch('https://europe-west3-eoxharvest-7953f.cloudfunctions.net/harvester',
            fetch(
                'https://europe-west3-eoxharvest-7953f.cloudfunctions.net/dummyharvester',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        tileX: i,
                        tileY: j,
                        tag: tagSelector.value,
                    }),
                }
            )
                .then((res) => {
                    return res.text();
                })
                .then((result) => {
                    //make rectangle and append it to the coordinates array
                    const point1 = tileXYToWGS84(i, j);
                    const point2 = tileXYToWGS84(i + 2, j + 2);
                    harvestedTilesCoordinates.push(
                        makeRectangle(point1, point2)
                    );
                    harvestedTilesGeoJSON.coordinates =
                        harvestedTilesCoordinates;
                    map.getSource('harvestedTiles').setData(
                        harvestedTilesGeoJSON
                    );
                    console.log(result);
                });
        }
    }
    clearSelection();
};

const updateTotalPerCategory = () => {
    fetch(
        'https://europe-west3-eoxharvest-7953f.cloudfunctions.net/countContentPerTag'
    )
        .then((res) => {
            return res.json();
        })
        .then((json) => {
            contentListUL.innerHTML = '';
            Object.entries(json).map(([key, value]) => {
                contentListUL.appendChild(
                    document.createElement('li')
                ).innerHTML = key + ': ' + value;
            });
        });
};

const clearSelection = () => {
    selectionBoundsXYtiles = [];
    selectionTilesGeoJSON.geometry.coordinates = [];
    map.getSource('selectionTiles').setData(selectionTilesGeoJSON);
    harvestInfoDiv.innerHTML = 'No Current Selection';
    // disable harvest and clear buttons
    document.getElementById('triggerHarvest').disabled = true;
    document.getElementById('cancelHarvest').disabled = true;
    selectionExists = false;
};

updateTotalPerCategory();

document.getElementById('setZoom').addEventListener('click', (e) => {
    map.setZoom(12);
});
document
    .getElementById('resetPitchAndBearing')
    .addEventListener('click', (e) => {
        map.resetNorthPitch();
    });
document
    .getElementById('updateCount')
    .addEventListener('click', (e) => updateTotalPerCategory());
document.getElementById('triggerHarvest').addEventListener('click', (e) => {
    harvest(selectionBoundsXYtiles);
});
document
    .getElementById('cancelHarvest')
    .addEventListener('click', (e) => clearSelection());

document.addEventListener('keydown', (e) => {
    if (e.keyCode == 67) {
        //c
        clearSelection();
    } else if (e.keyCode == 72) {
        //h
        harvest(selectionBoundsXYtiles);
    } else if (e.keyCode == 85) {
        //u
        updateTotalPerCategory();
    } else if (e.keyCode == 90) {
        //z
        map.setZoom(12);
    } else if (e.keyCode == 82) {
        //r
        map.resetNorthPitch();
    }
});

const updateOnMouseMove = (e) => {
    if (anchor) {
        rectangle = makeRectangle(e.lngLat, anchor);
        selectionGeoJSON.geometry.coordinates = rectangle;
        map.getSource('selection').setData(selectionGeoJSON);
        selectionExists = true;
    }
    currentTileCoordinatesDiv.innerHTML = JSON.stringify(
        WGS84ToTileXY([e.lngLat.lng, e.lngLat.lat])
    );
    currentCoordinatesDiv.innerHTML =
        'lat: ' +
        (Math.round(e.lngLat.wrap().lat * 100) / 100).toFixed(2) +
        ', lon: ' +
        (Math.round(e.lngLat.wrap().lng * 100) / 100).toFixed(2);
};

map.on('mousemove', updateOnMouseMove);

map.on('click', (e) => {
    if (!anchor) {
        anchor = e.lngLat;
    } else {
        // mark the actual area to harvest, we want an even number of tiles on both axis
        // get the tile positions from the coordinates of our rectangle
        let { tileX: topLeftTileX, tileY: topLeftTileY } = WGS84ToTileXY(
            rectangle[0][0]
        );
        let { tileX: bottomRightTileX, tileY: bottomRightTileY } =
            WGS84ToTileXY(rectangle[0][2]);
        // if we have selected only 1 tile in one of the directions, make it 2
        if (topLeftTileX == bottomRightTileX) {
            bottomRightTileX = bottomRightTileX + 1;
        }
        if (topLeftTileY == bottomRightTileY) {
            bottomRightTileY = bottomRightTileY + 1;
        }
        // because the coordinates are the top left corner of a tile, we want to add 1 to the bottom right corner on top of other adjustments
        // if the number of tiles in one of the directions is odd, add 2 tiles in this direction
        // if the number is even, only add one tile, to include the bottom right tile
        // the number of tiles is EVEN when top left - bottom right is ODD
        // 10 - 8 = 2, means we have tiles 10, 9 and 8
        if ((topLeftTileX - bottomRightTileX) % 2 == 0) {
            bottomRightTileX = bottomRightTileX + 2;
        } else {
            bottomRightTileX = bottomRightTileX + 1;
        }
        if ((topLeftTileY - bottomRightTileY) % 2 == 0) {
            bottomRightTileY = bottomRightTileY + 2;
        } else {
            bottomRightTileY = bottomRightTileY + 1;
        }
        // constrain the selection to a 12x12 square
        // we should harvest a maximum of 144 tiles per query (36 1024x1024 tiles)
        // this is to avoid overloading the EOX server
        if (bottomRightTileX - topLeftTileX > 12) {
            bottomRightTileX = topLeftTileX + 12;
        }
        if (bottomRightTileY - topLeftTileY > 12) {
            bottomRightTileY = topLeftTileY + 12;
        }
        selectionBoundsXYtiles = [
            topLeftTileX,
            topLeftTileY,
            bottomRightTileX,
            bottomRightTileY,
        ];
        const point1 = tileXYToWGS84(topLeftTileX, topLeftTileY);
        const point2 = tileXYToWGS84(bottomRightTileX, bottomRightTileY);
        const tilesRectangle = makeRectangle(point1, point2);
        selectionTilesGeoJSON.geometry.coordinates = tilesRectangle;
        map.getSource('selectionTiles').setData(selectionTilesGeoJSON);
        // iterate over the selection, skipping a tile in each direction and call the api for each
        harvestInfoDiv.innerHTML =
            ((bottomRightTileX - topLeftTileX) *
                (bottomRightTileY - topLeftTileY)) /
                4 +
            ' Tiles (1024 x 1024) Selected';
        // enable harvest and clear buttons if tag is set
        if (tagSelector.value != '') {
            document.getElementById('triggerHarvest').disabled = false;
            document.getElementById('cancelHarvest').disabled = false;
            tagWarning.classList.remove('tag-warning');
            tagWarning.innerHTML = '';
        } else {
            tagWarning.classList.add('tag-warning');
            tagWarning.innerHTML =
                '&#9650 Select a tag before harvesting tiles.';
        }
        // clear the selection
        rectangle = [];
        selectionGeoJSON.geometry.coordinates = rectangle;
        map.getSource('selection').setData(selectionGeoJSON);
        anchor = null;
    }
});

// remove warning if harvest selection exists and tag already set

tagSelector.onchange = function (e) {
    if (selectionExists) {
        document.getElementById('triggerHarvest').disabled = false;
        document.getElementById('cancelHarvest').disabled = false;
        tagWarning.classList.remove('tag-warning');
        tagWarning.innerHTML = '';
    }
};
