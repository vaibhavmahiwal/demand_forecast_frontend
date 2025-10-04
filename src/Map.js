import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon issue with webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});


const Map = () => {
  // Leaflet uses an array [lat, lng] for coordinates
  const centerOfIndia = [22.5937, 78.9629];

  // Coordinates for major Indian cities in [lat, lng] format
  const majorCities = [
    { name: 'Delhi', position: [28.7041, 77.1025] },
    { name: 'Mumbai', position: [19.0760, 72.8777] },
    { name: 'Kolkata', position: [22.5726, 88.3639] },
    { name: 'Chennai', position: [13.0827, 80.2707] },
    { name: 'Bengaluru', position: [12.9716, 77.5946] },
    { name: 'Hyderabad', position: [17.3850, 78.4867] },
    { name: 'Ahmedabad', position: [23.0225, 72.5714] },
    { name: 'Pune', position: [18.5204, 73.8567] }
  ];

  return (
    <MapContainer 
      center={centerOfIndia} 
      zoom={5} 
      style={{ height: '450px', width: '100%' }}
      className="rounded-2xl"
    >
      {/* TileLayer fetches and displays the map tiles from OpenStreetMap. */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Loop through cities and create a Marker for each one. */}
      {majorCities.map(city => (
        <Marker key={city.name} position={city.position}>
          {/* Popup shows the city name when you click the marker. */}
          <Popup>
            {city.name}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default Map;