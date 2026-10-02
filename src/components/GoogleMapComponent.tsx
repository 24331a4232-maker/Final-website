import React, { useState } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
} from '@vis.gl/react-google-maps';
import { MapPin, Calendar, Clock, AlertCircle, Building2, Utensils, CheckCircle } from 'lucide-react';

export interface FoodPickupLocation {
  id: string;
  title: string;
  donorName: string;
  category: string;
  quantity: string;
  servings: number;
  address: string;
  lat: number;
  lng: number;
  pickupTime: string;
  expiryTime: string;
  status: 'available' | 'claimed' | 'in_transit';
}

const DEFAULT_CENTER = { lat: 1.3521, lng: 103.8198 }; // Singapore / Southeast Asia central coordinates

const SAMPLE_PICKUPS: FoodPickupLocation[] = [
  {
    id: 'fp-1',
    title: 'Surplus Banquet Buffet & Bakery Pastries',
    donorName: 'Grand Hyatt Hotel & Banquet',
    category: 'Cooked Meals & Pastries',
    quantity: '45 kg',
    servings: 120,
    address: '10 Scotts Road, Orchard District',
    lat: 1.3066,
    lng: 103.8329,
    pickupTime: 'Today, 2:00 PM – 4:00 PM',
    expiryTime: 'Within 6 hours',
    status: 'available',
  },
  {
    id: 'fp-2',
    title: 'Artisan Sourdough, Baguettes & Croissants',
    donorName: 'Golden Crust Bakery & Cafe',
    category: 'Bakery',
    quantity: '28 kg',
    servings: 80,
    address: '56 Zion Road, River Valley',
    lat: 1.2931,
    lng: 103.8344,
    pickupTime: 'Today, 5:30 PM – 7:00 PM',
    expiryTime: 'Within 12 hours',
    status: 'available',
  },
  {
    id: 'fp-3',
    title: 'Packaged Fresh Salads & Bento Boxes',
    donorName: 'Marina Corporate Catering Hub',
    category: 'Packaged Meals',
    quantity: '60 boxes',
    servings: 60,
    address: '8 Marina Boulevard, Financial Centre',
    lat: 1.2801,
    lng: 103.8542,
    pickupTime: 'Today, 3:00 PM – 4:30 PM',
    expiryTime: 'Within 4 hours',
    status: 'claimed',
  },
  {
    id: 'fp-4',
    title: 'Surplus Fresh Organic Fruits & Vegetables',
    donorName: 'Central Wholesale Fresh Mart',
    category: 'Fresh Produce',
    quantity: '110 kg',
    servings: 250,
    address: '1 Pasir Panjang Wholesale Centre',
    lat: 1.2862,
    lng: 103.7828,
    pickupTime: 'Today, 1:00 PM – 5:00 PM',
    expiryTime: 'Within 24 hours',
    status: 'available',
  },
  {
    id: 'fp-5',
    title: 'Steamed Rice, Stews & Lentil Curries',
    donorName: 'Heritage Spice Banquet & Events',
    category: 'Cooked Meals',
    quantity: '35 kg',
    servings: 95,
    address: '12 Buffalo Road, Little India',
    lat: 1.3075,
    lng: 103.8512,
    pickupTime: 'Today, 6:00 PM – 8:00 PM',
    expiryTime: 'Within 5 hours',
    status: 'available',
  },
];

interface GoogleMapComponentProps {
  onScheduleCalendar?: (pickup: FoodPickupLocation) => void;
}

export const GoogleMapComponent: React.FC<GoogleMapComponentProps> = ({ onScheduleCalendar }) => {
  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';
  const [selectedPickup, setSelectedPickup] = useState<FoodPickupLocation | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredPickups = SAMPLE_PICKUPS.filter((p) => {
    const matchesCat = activeCategory === 'All' || p.category.toLowerCase().includes(activeCategory.toLowerCase());
    const matchesQuery =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.donorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.address.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  if (!apiKey) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-900">
        <AlertCircle className="mx-auto mb-2 h-8 w-8 text-amber-600" />
        <h3 className="text-lg font-bold">Google Maps API Key Missing</h3>
        <p className="mt-1 text-sm text-amber-700">
          Please ensure <code>VITE_GOOGLE_MAPS_API_KEY</code> is configured in your environment.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl dark:border-stone-800 dark:bg-stone-900">
      {/* Map Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 bg-stone-50/80 p-4 backdrop-blur dark:border-stone-800 dark:bg-stone-950/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="font-bold text-stone-900 dark:text-stone-100">Live Surplus Food Pickup Map</h3>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Powered by Google Maps Platform • Real-time location intelligence for food rescue
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {['All', 'Cooked Meals', 'Bakery', 'Fresh Produce'].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                activeCategory === cat
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-stone-200/70 text-stone-700 hover:bg-stone-300 dark:bg-stone-800 dark:text-stone-300'
              }`}
            >
              {cat}
            </button>
          ))}
          <input
            type="text"
            placeholder="Search venue or food..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-lg border border-stone-300 bg-white px-3 py-1 text-xs text-stone-800 shadow-sm focus:border-emerald-500 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
          />
        </div>
      </div>

      {/* Google Map Viewport */}
      <div className="relative h-[480px] w-full">
        <APIProvider apiKey={apiKey}>
          <Map
            defaultCenter={DEFAULT_CENTER}
            defaultZoom={12}
            mapId="DEMO_MAP_ID"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            gestureHandling="greedy"
            disableDefaultUI={false}
            className="h-full w-full"
          >
            {filteredPickups.map((pickup) => (
              <AdvancedMarker
                key={pickup.id}
                position={{ lat: pickup.lat, lng: pickup.lng }}
                onClick={() => setSelectedPickup(pickup)}
                title={pickup.title}
              >
                <Pin
                  background={pickup.status === 'available' ? '#16A34A' : '#EAB308'}
                  borderColor="#FFFFFF"
                  glyphColor="#FFFFFF"
                  scale={1.1}
                />
              </AdvancedMarker>
            ))}

            {selectedPickup && (
              <InfoWindow
                position={{ lat: selectedPickup.lat, lng: selectedPickup.lng }}
                onCloseClick={() => setSelectedPickup(null)}
              >
                <div className="max-w-xs p-1 text-stone-900">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{selectedPickup.donorName}</span>
                  </div>
                  <h4 className="mt-1 font-semibold text-sm leading-snug">{selectedPickup.title}</h4>
                  
                  <div className="mt-2 space-y-1 text-xs text-stone-600">
                    <div className="flex items-center gap-1">
                      <Utensils className="h-3 w-3 text-stone-400" />
                      <span>{selectedPickup.quantity} ({selectedPickup.servings} estimated servings)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-stone-400" />
                      <span>{selectedPickup.pickupTime}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-stone-400" />
                      <span>{selectedPickup.address}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-stone-200 pt-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        selectedPickup.status === 'available'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {selectedPickup.status === 'available' ? 'Ready for Pickup' : 'Claimed'}
                    </span>

                    {onScheduleCalendar && (
                      <button
                        onClick={() => onScheduleCalendar(selectedPickup)}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 transition"
                      >
                        <Calendar className="h-3 w-3" />
                        Sync to Calendar
                      </button>
                    )}
                  </div>
                </div>
              </InfoWindow>
            )}
          </Map>
        </APIProvider>
      </div>

      {/* Location Card Grid */}
      <div className="grid grid-cols-1 divide-y border-t border-stone-200 bg-stone-50/50 sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:border-stone-800 dark:bg-stone-900/50">
        {filteredPickups.slice(0, 3).map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedPickup(item)}
            className="cursor-pointer p-4 transition hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {item.category}
                </span>
                <h5 className="font-semibold text-sm text-stone-900 dark:text-stone-100">{item.donorName}</h5>
              </div>
              <span className="rounded-full bg-stone-200/70 px-2 py-0.5 text-[10px] font-medium text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                {item.quantity}
              </span>
            </div>
            <p className="mt-1 line-clamp-1 text-xs text-stone-600 dark:text-stone-400">{item.title}</p>
            <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {item.pickupTime.split(',')[0]}
              </span>
              <span className="font-medium text-emerald-700 dark:text-emerald-400">
                {item.servings} meals
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
