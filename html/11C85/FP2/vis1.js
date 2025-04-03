// We'll load the data from the CSV file
let properties = [];

// Set your mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoieGRkNDQiLCJhIjoiY205MWllMWk1MDFhdjJ3b2pyZGR2aDZkeiJ9.0hs7-AJr3fOz-izEVbmu-g';

// Initialize the map
const map = new mapboxgl.Map({
    container: 'vis1',
    style: 'mapbox://styles/mapbox/light-v11',
    center: [-71.0565, 42.3555], // Boston coordinates
    zoom: 13
});

// Define color scale for property prices
const minPrice = d3.min(properties, d => d.price);
const maxPrice = d3.max(properties, d => d.price);
const colorScale = d3.scaleLinear()
    .domain([minPrice, maxPrice])
    .range(['#fee0d2', '#de2d26']);

// Load and parse the CSV file
d3.csv('A2_EDA_Residential_Price.csv')
    .then(data => {
        // Process the loaded data
        properties = data
            .filter(d => d.lat && d.lon && d.price && !isNaN(d.lat) && !isNaN(d.lon) && !isNaN(+d.price))
            .map(d => ({
                address: d.address || 'Unknown Address',
                price: +d.price,
                lat: +d.lat,
                lon: +d.lon,
                year: +d.year || 'N/A'
            }));

        console.log(`Loaded ${properties.length} properties with valid coordinates and prices`);
        
        // Once data is loaded, initialize the map
        initializeMap();
    })
    .catch(error => {
        console.error('Error loading the CSV file:', error);
        // Show error message on the page
        document.getElementById('vis1').innerHTML = `
            <div style="padding: 20px; background-color: #f8d7da; color: #721c24; text-align: center;">
                <h3>Error Loading Data</h3>
                <p>Could not load the CSV file "A2_EDA_Residential_Price.csv". Please make sure the file is in the same folder as this HTML file.</p>
                <p>Technical details: ${error.message}</p>
            </div>
        `;
    });

function initializeMap() {
    const map = new mapboxgl.Map({
        container: 'vis1',
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-71.075, 42.351], // Boston coordinates
        zoom: 14,
        interactive: false
    });

    // Define color scale for property prices
    const minPrice = d3.min(properties, d => d.price);
    const maxPrice = d3.max(properties, d => d.price);
    
    // Use a more sophisticated color scale with quantiles for better distribution
    const priceQuantiles = [0, 0.2, 0.4, 0.6, 0.8, 1].map(q => 
        d3.quantile(properties.map(d => d.price), q)
    );
    
    // Using a sequential color scheme from light to dark
    const colorScale = d3.scaleLinear()
        .domain(priceQuantiles)
        .range(['#fee5d9', '#fcbba1', '#fc9272', '#fb6a4a', '#de2d26', '#a50f15'])
        .interpolate(d3.interpolateHcl);

    map.on('load', () => {
        // Add properties to the map as a source
        map.addSource('properties', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: properties.map(prop => ({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [prop.lon, prop.lat]
                    },
                    properties: prop
                }))
            }
        });

        // Add a layer for the properties
        map.addLayer({
            id: 'property-points',
            type: 'circle',
            source: 'properties',
            paint: {
                // Adjust circle size based on zoom level
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    10, 2,  // Smaller at zoom level 10
                    14, 5,  // Medium at zoom level 14
                    16, 8   // Larger at zoom level 16+
                ],
                'circle-color': ['get', 'color'],
                'circle-opacity': 0.7,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#fff'
            }
        });

        // Assign colors to each feature based on price
        const featureCollection = map.getSource('properties')._data;
        featureCollection.features.forEach(feature => {
            feature.properties.color = colorScale(feature.properties.price);
        });
        map.getSource('properties').setData(featureCollection);

        // Create a popup for each property
        const popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false
        });

        // Show popup on hover
        map.on('mouseenter', 'property-points', (e) => {
            map.getCanvas().style.cursor = 'pointer';
            
            const coordinates = e.features[0].geometry.coordinates.slice();
            const properties = e.features[0].properties;
            
            // Create a formatter for the price
            const formatter = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0
            });
            
            // Format information for the popup
            const price = formatter.format(properties.price);
            
            const popupContent = `
                <b>${properties.address}</b><br>
                Price: ${price}<br>
                Year: ${properties.year}<br>
            `;

            popup.setLngLat(coordinates)
                .setHTML(popupContent)
                .addTo(map);
        });

        map.on('mouseleave', 'property-points', () => {
            map.getCanvas().style.cursor = '';
            popup.remove();
        });

        // Add legend
        const legend = document.getElementById('legend1');
        legend.innerHTML = `
            <div id="price-stats">
                <p>Properties: ${properties.length}</p>
                <p>Avg: $${Math.round(d3.mean(properties, d => d.price)).toLocaleString()}</p>
            </div>
        `;

        // Create a legend with quantiles for better distribution
        const numSteps = 5;
        const priceFormatter = new Intl.NumberFormat('en-US', {
            style: 'currency', 
            currency: 'USD', 
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
        
        // Use quantiles for more representative color ranges
        const quantiles = [];
        for (let i = 0; i <= numSteps; i++) {
            quantiles.push(d3.quantile(properties.map(d => d.price), i / numSteps));
        }
        
        for (let i = 1; i < numSteps; i++) {
            const rangeStart = quantiles[i];
            const rangeEnd = quantiles[i+1];
            const color = colorScale(rangeStart);
            
            const item = document.createElement('div');
            const priceDisplay = i === 0 ? 
                `${priceFormatter.format(rangeStart)}` : 
                `${priceFormatter.format(rangeStart)} - ${priceFormatter.format(rangeEnd)}`;
                
            item.innerHTML = `<span style="background:${color}"></span>${priceDisplay}`;
            legend.appendChild(item);
        }
    });
    
// Add navigation controls
// map.addControl(new mapboxgl.NavigationControl());
}