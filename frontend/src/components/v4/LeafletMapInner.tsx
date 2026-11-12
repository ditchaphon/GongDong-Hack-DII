'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPoint } from './MapPinPicker';

interface LeafletMapInnerProps {
  value: MapPoint | null;
  onChange: (point: MapPoint) => void;
  error?: string;
  className?: string;
}

const DEFAULT_CENTER: [number, number] = [18.8023, 98.9524]; // มหาวิทยาลัยเชียงใหม่ (หอสมุดกลาง)
const DEFAULT_ZOOM = 15;

export default function LeafletMapInner({
  value,
  onChange,
  error,
  className,
}: LeafletMapInnerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // SVG Marker Pin สำหรับความคมชัดและไม่พบปัญหา Asset 404 ใน Next.js Webpack
  const pinIcon = L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div style="transform: translate(-50%, -100%); cursor: pointer;">
        <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 24 24" fill="#f43f5e" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35));">
          <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
          <circle cx="12" cy="10" r="3" fill="#ffffff"/>
        </svg>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [0, 0],
  });

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialCenter: [number, number] =
      value && value.lat && value.lng ? [value.lat, value.lng] : DEFAULT_CENTER;

    // สร้าง Map Instance
    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: true,
    });

    mapInstanceRef.current = map;

    // แผ่นแผนที่ OpenStreetMap Tile Server ฟรี
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    // สร้าง Marker ถ้ามีพิกัดเริ่มต้น
    if (value && value.lat && value.lng) {
      const marker = L.marker([value.lat, value.lng], {
        icon: pinIcon,
        draggable: true,
      }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onChange({
          lat: Number(pos.lat.toFixed(6)),
          lng: Number(pos.lng.toFixed(6)),
        });
      });

      markerRef.current = marker;
    }

    // เมื่อผู้ใช้แตะหรือคลิกบนแผนที่ ให้ย้ายหมุดและอัปเดตพิกัด
    map.on('click', (e: L.LeafletMouseEvent) => {
      const newPoint: MapPoint = {
        lat: Number(e.latlng.lat.toFixed(6)),
        lng: Number(e.latlng.lng.toFixed(6)),
      };

      if (!markerRef.current) {
        const marker = L.marker([newPoint.lat, newPoint.lng], {
          icon: pinIcon,
          draggable: true,
        }).addTo(map);

        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onChange({
            lat: Number(pos.lat.toFixed(6)),
            lng: Number(pos.lng.toFixed(6)),
          });
        });

        markerRef.current = marker;
      }

      markerRef.current.setLatLng([newPoint.lat, newPoint.lng]);
      onChange(newPoint);
    });

    // คืนทรัพยากรเมื่อ Unmount
    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // เมื่อ value เปลี่ยนจากภายนอก (เช่น กดปุ่ม GPS) ให้อัปเดต Marker และ Pan แผนที่
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !value) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([value.lat, value.lng]);
    } else {
      const marker = L.marker([value.lat, value.lng], {
        icon: pinIcon,
        draggable: true,
      }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onChange({
          lat: Number(pos.lat.toFixed(6)),
          lng: Number(pos.lng.toFixed(6)),
        });
      });

      markerRef.current = marker;
    }

    map.panTo([value.lat, value.lng], { animate: true });
  }, [value?.lat, value?.lng]);

  return (
    <div
      ref={mapContainerRef}
      className={`w-full h-full rounded-2xl overflow-hidden z-0 ${className ?? ''}`}
      style={{ minHeight: '260px' }}
    />
  );
}
