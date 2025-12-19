import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, FileText, X, CheckCircle } from 'lucide-react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L, { type LeafletMouseEvent } from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  type: string;
  file: File;
}

export default function FileUploadSection() {
  const STORAGE_FORM = 'ed_extractedFormData';
  const STORAGE_MESSAGE = 'ed_submitMessage';
  const STORAGE_ERROR = 'ed_submitError';

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptText, setReceiptText] = useState<string | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receiptCopied, setReceiptCopied] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_MESSAGE);
    } catch {
      return null;
    }
  });
  const [submitError, setSubmitError] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_ERROR) === 'true';
    } catch {
      return false;
    }
  });
  const [formData, setFormData] = useState<any | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_FORM);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const suppressGeocodeRef = useRef(false);
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const lastPickupAddressRef = useRef<string>('');

  const dropoffMarkerIcon = useMemo(
    () =>
      L.icon({
        iconRetinaUrl: markerIcon2x,
        iconUrl: markerIcon,
        shadowUrl: markerShadow,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      }),
    []
  );

  useEffect(() => {
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: markerIcon2x,
      iconUrl: markerIcon,
      shadowUrl: markerShadow,
    });
  }, []);

  const clearPersisted = () => {
    try {
      localStorage.removeItem(STORAGE_FORM);
      localStorage.removeItem(STORAGE_MESSAGE);
      localStorage.removeItem(STORAGE_ERROR);
    } catch {
      // ignore
    }
  };

  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    const q = address.trim();
    if (!q) return null;

    const parts = q.split(',').map((p) => p.trim()).filter(Boolean);
    const idxWithNumber = parts.findIndex((p) => /\d/.test(p));
    const normalizedQuery = idxWithNumber > 0 ? parts.slice(idxWithNumber).join(', ') : q;
    const looksLikeCanada =
      /\bcanada\b/i.test(q) ||
      /\bquébec\b/i.test(q) ||
      /\bqc\b/i.test(q) ||
      /\bmontreal\b/i.test(q) ||
      /\b,\s*ca\s*$/i.test(q);
    const countrycodes = looksLikeCanada ? '&countrycodes=ca' : '';

    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1${countrycodes}&q=${encodeURIComponent(normalizedQuery)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = Number(data[0].lat);
    const lng = Number(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  };

  const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { display_name?: string };
    return data?.display_name ?? null;
  };

  const dropoffCoords = useMemo(() => {
    const addr = String(formData?.dropoff_location?.address ?? '').trim();
    if (!addr) return null;
    const lat = Number(formData?.dropoff_location?.lat);
    const lng = Number(formData?.dropoff_location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, [formData?.dropoff_location?.address, formData?.dropoff_location?.lat, formData?.dropoff_location?.lng]);

  useEffect(() => {
    if (!formData) return;
    const addr = String(formData?.dropoff_location?.address ?? '').trim();
    if (addr) return;

    const lat = String(formData?.dropoff_location?.lat ?? '').trim();
    const lng = String(formData?.dropoff_location?.lng ?? '').trim();
    if (!lat && !lng) return;

    updateFormField('dropoff_location', 'lat', '');
    updateFormField('dropoff_location', 'lng', '');
  }, [formData?.dropoff_location?.address]);

  useEffect(() => {
    if (!formData) return;
    const pickupAddress = String(formData?.pickup_location?.address ?? '').trim();
    if (!pickupAddress) return;

    if (lastPickupAddressRef.current === pickupAddress && pickupCoords) return;
    lastPickupAddressRef.current = pickupAddress;

    const timer = window.setTimeout(async () => {
      try {
        const result = await geocodeAddress(pickupAddress);
        if (!result) return;
        setPickupCoords(result);
      } catch {
        // ignore
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [formData?.pickup_location?.address]);

  useEffect(() => {
    if (!formData) return;

    const address = String(formData?.dropoff_location?.address ?? '');
    if (!address.trim()) return;
    if (suppressGeocodeRef.current) {
      suppressGeocodeRef.current = false;
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const result = await geocodeAddress(address);
        if (!result) return;
        updateFormField('dropoff_location', 'lat', String(result.lat));
        updateFormField('dropoff_location', 'lng', String(result.lng));
      } catch {
        // ignore
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [formData?.dropoff_location?.address]);

  const DropoffMapUpdater = ({ lat, lng }: { lat: number; lng: number }) => {
    const map = useMap();
    useEffect(() => {
      map.setView([lat, lng], Math.max(map.getZoom(), 13), { animate: true });
    }, [lat, lng, map]);
    return null;
  };

  const DropoffMapClickHandler = () => {
    useMapEvents({
      click: async (e: LeafletMouseEvent) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        updateFormField('dropoff_location', 'lat', String(lat));
        updateFormField('dropoff_location', 'lng', String(lng));

        try {
          const addr = await reverseGeocode(lat, lng);
          if (addr) {
            suppressGeocodeRef.current = true;
            updateFormField('dropoff_location', 'address', addr);
          }
        } catch {
          // ignore
        }
      },
    });
    return null;
  };

  useEffect(() => {
    try {
      if (formData) {
        localStorage.setItem(STORAGE_FORM, JSON.stringify(formData));
      } else {
        localStorage.removeItem(STORAGE_FORM);
      }

      if (submitMessage === null) {
        localStorage.removeItem(STORAGE_MESSAGE);
      } else {
        localStorage.setItem(STORAGE_MESSAGE, submitMessage);
      }

      localStorage.setItem(STORAGE_ERROR, submitError ? 'true' : 'false');
    } catch {
      // ignore
    }
  }, [formData, submitMessage, submitError]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('Failed to read file'));
          return;
        }
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const initFormData = (output: any) => {
    if (!output) return null;

    const extractedDropoffAddress = output?.dropoff_location?.address ?? output?.drop_off_location?.address ?? '';
    const extractedDropoffName = output?.dropoff_location?.name ?? output?.drop_off_location?.name ?? '';
    const extractedDropoffPhone = output?.dropoff_location?.phone ?? output?.drop_off_location?.phone ?? '';
    const extractedDropoffLat = output?.dropoff_location?.lat ?? output?.drop_off_location?.lat;
    const extractedDropoffLng = output?.dropoff_location?.lng ?? output?.drop_off_location?.lng;

    const dropoffAddress = extractedDropoffAddress;
    const dropoffName = extractedDropoffName;
    const dropoffPhone = extractedDropoffPhone;
    const dropoffLat = extractedDropoffLat?.toString?.() ?? '';
    const dropoffLng = extractedDropoffLng?.toString?.() ?? '';

    return {
      vehicle: {
        vin: output?.vehicle?.vin ?? '',
        year: output?.vehicle?.year?.toString?.() ?? '',
        make: output?.vehicle?.make ?? '',
        model: output?.vehicle?.model ?? '',
        transmission: output?.vehicle?.transmission ?? '',
        odometer_km: output?.vehicle?.odometer_km?.toString?.() ?? '',
        exterior_color: output?.vehicle?.exterior_color ?? '',
        interior_color: output?.vehicle?.interior_color ?? '',
        has_accident: output?.vehicle?.has_accident ?? '',
      },
      selling_dealership: {
        name: output?.selling_dealership?.name ?? '',
        phone: output?.selling_dealership?.phone ?? '',
        address: output?.selling_dealership?.address ?? '',
      },
      buying_dealership: {
        name: output?.buying_dealership?.name ?? '',
        phone: output?.buying_dealership?.phone ?? '',
        contact_name: output?.buying_dealership?.contact_name ?? '',
      },
      pickup_location: {
        name: output?.pickup_location?.name ?? '',
        address: output?.pickup_location?.address ?? '',
        phone: output?.pickup_location?.phone ?? '',
      },
      dropoff_location: {
        name: dropoffName,
        phone: dropoffPhone,
        address: dropoffAddress,
        lat: dropoffLat,
        lng: dropoffLng,
      },
      transaction: {
        transaction_id: output?.transaction?.transaction_id ?? '',
        release_form_number: output?.transaction?.release_form_number ?? '',
        release_date: output?.transaction?.release_date ?? '',
        arrival_date: output?.transaction?.arrival_date ?? '',
      },
      authorization: {
        released_by_name: output?.authorization?.released_by_name ?? '',
        released_to_name: output?.authorization?.released_to_name ?? '',
      },
      dealer_notes: output?.dealer_notes ?? '',
    };
  };

  const updateFormField = (section: string, key: string, value: string) => {
    setFormData((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        [section]: {
          ...(prev?.[section] ?? {}),
          [key]: value,
        },
      };
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (files: FileList) => {
    const file = files[0];
    if (!file) return;

    const newFile: UploadedFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: formatFileSize(file.size),
      type: file.type || 'unknown',
      file,
    };

    clearPersisted();
    setSubmitMessage(null);
    setSubmitError(false);
    setReceiptText(null);
    setIsReceiptOpen(false);
    setFormData(null);
    setUploadedFiles([newFile]);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleSubmitDocuments = async () => {
    if (isSubmitting) return;

    if (formData) {
      setIsSubmitting(true);
      setSubmitMessage(null);
      setSubmitError(false);

      try {
        setReceiptText(null);
        setIsReceiptOpen(false);
        const user = (() => {
          try {
            const token = localStorage.getItem('ed_googleCredential');
            if (!token) return { name: '', email: '' };

            const parts = token.split('.');
            if (parts.length < 2) return { name: '', email: '' };

            const base64Url = parts[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
            const json = atob(padded);
            const payload = JSON.parse(json) as { name?: string; email?: string };
            return {
              name: payload?.name ?? '',
              email: payload?.email ?? '',
            };
          } catch {
            return { name: '', email: '' };
          }
        })();

        const files = await Promise.all(
          uploadedFiles.map(async (f) => ({
            name: f.name,
            type: f.type,
            size: f.file.size,
            base64: await fileToBase64(f.file),
          }))
        );

        const webhookRes = await fetch('https://primary-production-6722.up.railway.app/webhook/Dox', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            submittedAt: new Date().toISOString(),
            user,
            userName: user.name || user.email || 'Account',
            files,
            formData,
          }),
        });

        if (!webhookRes.ok) {
          const text = await webhookRes.text().catch(() => '');
          throw new Error(text || `Webhook failed (${webhookRes.status})`);
        }

        const responseJson = await webhookRes.json().catch(() => null);
        const responseText = Array.isArray(responseJson) ? responseJson?.[0]?.text : responseJson?.text;
        if (typeof responseText === 'string' && responseText.trim()) {
          setReceiptText(responseText);
          setIsReceiptOpen(true);
        }

        setSubmitMessage('Document submitted successfully.');
        setSubmitError(false);

        clearPersisted();
        setFormData(null);
        setUploadedFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        setSubmitMessage(err instanceof Error ? err.message : 'Submit failed');
        setSubmitError(true);
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    if (uploadedFiles.length === 0) {
      setSubmitMessage('Please select a file to submit.');
      setSubmitError(true);
      onButtonClick();
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage(null);
    setSubmitError(false);

    try {
      const files = await Promise.all(
        uploadedFiles.map(async (f) => ({
          name: f.name,
          type: f.type,
          size: f.file.size,
          base64: await fileToBase64(f.file),
        }))
      );

      const res = await fetch('https://primary-production-6722.up.railway.app/webhook/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Upload failed (${res.status})`);
      }

      const data = await res.json().catch(() => null);
      const output = Array.isArray(data) ? data?.[0]?.output : data?.output;
      const extracted = initFormData(output);
      setFormData(extracted);
      setReceiptText(null);
      setIsReceiptOpen(false);

      setSubmitMessage('Document extracted successfully. Please review the details then click Submit Document.');
      setSubmitError(false);
    } catch (err) {
      setSubmitMessage(err instanceof Error ? err.message : 'Upload failed');
      setSubmitError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {isReceiptOpen && receiptText && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setIsReceiptOpen(false);
              setReceiptText(null);
              setReceiptCopied(false);
            }
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-black/70 backdrop-blur-sm"></div>

          <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]">
            <div className="bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-white">Receipt</div>
                    <div className="mt-0.5 text-xs font-medium text-white/80">Submission confirmed</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(receiptText);
                        setReceiptCopied(true);
                        window.setTimeout(() => setReceiptCopied(false), 1500);
                      } catch {
                        setReceiptCopied(false);
                      }
                    }}
                    className="inline-flex items-center rounded-xl bg-white/15 px-3 py-2 text-sm font-medium text-white ring-1 ring-white/20 hover:bg-white/20 transition-colors"
                  >
                    {receiptCopied ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsReceiptOpen(false);
                      setReceiptText(null);
                      setReceiptCopied(false);
                    }}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 text-white hover:bg-white/20 transition-colors"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-7">
              <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-4 sm:p-5 shadow-sm">
                <pre className="whitespace-pre-wrap text-sm leading-6 text-gray-800 max-h-[60vh] overflow-auto">
                  {receiptText}
                </pre>
              </div>

              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-gray-500">
                  You can close this receipt and upload a new document.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsReceiptOpen(false);
                    setReceiptText(null);
                    setReceiptCopied(false);
                  }}
                  className="inline-flex justify-center rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="mb-6">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-1 sm:mb-2">Upload Documents</h3>
        <p className="text-sm sm:text-base text-gray-600">Upload vehicle release forms, work orders, or any related documentation</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        onChange={handleChange}
        className="hidden"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
      />

      {uploadedFiles.length === 0 && !formData && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 sm:p-12 text-center transition-all ${
            dragActive
              ? 'border-cyan-500 bg-cyan-50'
              : 'border-gray-300 hover:border-cyan-400 bg-gray-50'
          }`}
        >
          <div className="flex flex-col items-center">
            <div className="bg-cyan-50 p-4 rounded-full mb-4">
              <Upload className="w-10 h-10 text-cyan-500" />
            </div>
            <p className="text-base sm:text-lg font-medium text-gray-800 mb-2">
              Drag and drop files here
            </p>
            <p className="text-gray-500 mb-4">or</p>
            <button
              onClick={onButtonClick}
              className="w-full sm:w-auto bg-cyan-500 text-white px-6 py-3 rounded-lg hover:bg-cyan-600 transition-colors font-medium"
            >
              Browse Files
            </button>
            <p className="text-sm text-gray-500 mt-4">
              Supported formats: PDF, DOC, DOCX, JPG, PNG (Max 10MB)
            </p>
          </div>
        </div>
      )}

      {(uploadedFiles.length > 0 || formData) && (
        <div className="mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h4 className="text-base sm:text-lg font-semibold text-gray-800">Uploaded Files</h4>
            <button
              onClick={onButtonClick}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Replace File
            </button>
          </div>
          {uploadedFiles.length > 0 ? (
            <div className="space-y-3">
              {uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-gray-200 rounded-lg p-4 hover:border-cyan-500 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-cyan-50 p-2 rounded">
                      <FileText className="w-6 h-6 text-cyan-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{file.name}</p>
                      <p className="text-sm text-gray-500">{file.size}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <button
                      onClick={() => removeFile(file.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              No file selected (page refresh clears the file). Use “Replace File” if you need to upload again.
            </div>
          )}

          {submitMessage && (
            <div className={`mt-4 text-sm font-medium ${submitError ? 'text-red-600' : 'text-green-600'}`}>
              {submitMessage}
            </div>
          )}

          {formData && (
            <div className="mt-6 border border-gray-200 rounded-lg p-4 sm:p-6 bg-gray-50">
              <h4 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">Extracted Details</h4>

              <div className="mb-6">
                <h5 className="text-sm font-semibold text-gray-700 mb-3">Vehicle</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">VIN</label>
                    <input value={formData.vehicle.vin} onChange={(e) => updateFormField('vehicle', 'vin', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Year</label>
                    <input value={formData.vehicle.year} onChange={(e) => updateFormField('vehicle', 'year', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Make</label>
                    <input value={formData.vehicle.make} onChange={(e) => updateFormField('vehicle', 'make', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Model</label>
                    <input value={formData.vehicle.model} onChange={(e) => updateFormField('vehicle', 'model', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Transmission</label>
                    <input value={formData.vehicle.transmission} onChange={(e) => updateFormField('vehicle', 'transmission', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Odometer (km)</label>
                    <input value={formData.vehicle.odometer_km} onChange={(e) => updateFormField('vehicle', 'odometer_km', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Exterior Color</label>
                    <input value={formData.vehicle.exterior_color} onChange={(e) => updateFormField('vehicle', 'exterior_color', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Interior Color</label>
                    <input value={formData.vehicle.interior_color} onChange={(e) => updateFormField('vehicle', 'interior_color', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Has Accident</label>
                    <input value={formData.vehicle.has_accident} onChange={(e) => updateFormField('vehicle', 'has_accident', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h5 className="text-sm font-semibold text-gray-700 mb-3">Selling Dealership</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Name</label>
                    <input value={formData.selling_dealership.name} onChange={(e) => updateFormField('selling_dealership', 'name', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Phone</label>
                    <input value={formData.selling_dealership.phone} onChange={(e) => updateFormField('selling_dealership', 'phone', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Address</label>
                    <input value={formData.selling_dealership.address} onChange={(e) => updateFormField('selling_dealership', 'address', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h5 className="text-sm font-semibold text-gray-700 mb-3">Buying Dealership</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Name</label>
                    <input value={formData.buying_dealership.name} onChange={(e) => updateFormField('buying_dealership', 'name', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Phone</label>
                    <input value={formData.buying_dealership.phone} onChange={(e) => updateFormField('buying_dealership', 'phone', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Contact Name</label>
                    <input value={formData.buying_dealership.contact_name} onChange={(e) => updateFormField('buying_dealership', 'contact_name', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h5 className="text-sm font-semibold text-gray-700 mb-3">Pickup Location</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Name</label>
                    <input value={formData.pickup_location.name} onChange={(e) => updateFormField('pickup_location', 'name', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Phone</label>
                    <input value={formData.pickup_location.phone} onChange={(e) => updateFormField('pickup_location', 'phone', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Address</label>
                    <input value={formData.pickup_location.address} onChange={(e) => updateFormField('pickup_location', 'address', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h5 className="text-sm font-semibold text-gray-700 mb-3">Drop-off Location</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Name</label>
                    <input value={String(formData?.dropoff_location?.name ?? '')} onChange={(e) => updateFormField('dropoff_location', 'name', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Phone</label>
                    <input value={String(formData?.dropoff_location?.phone ?? '')} onChange={(e) => updateFormField('dropoff_location', 'phone', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Address</label>
                    <input
                      value={String(formData?.dropoff_location?.address ?? '')}
                      onChange={(e) => updateFormField('dropoff_location', 'address', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Type address to auto-pin on the map"
                    />
                    <div className="mt-2 text-xs text-gray-500">
                      Click the map to pin the drop-off location (auto-fills address), or type an address to auto-pin.
                    </div>
                  </div>
                </div>

                <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden bg-white h-60 sm:h-80">
                  <MapContainer
                    center={dropoffCoords ? [dropoffCoords.lat, dropoffCoords.lng] : pickupCoords ? [pickupCoords.lat, pickupCoords.lng] : [45.5017, -73.5673]}
                    zoom={dropoffCoords || pickupCoords ? 13 : 10}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='Tiles &copy; Esri'
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    />
                    <DropoffMapClickHandler />
                    {(dropoffCoords || pickupCoords) && (
                      <>
                        <DropoffMapUpdater
                          lat={(dropoffCoords ?? pickupCoords)!.lat}
                          lng={(dropoffCoords ?? pickupCoords)!.lng}
                        />
                        <Marker
                          position={[(dropoffCoords ?? pickupCoords)!.lat, (dropoffCoords ?? pickupCoords)!.lng]}
                          icon={dropoffMarkerIcon}
                        />
                      </>
                    )}
                  </MapContainer>
                </div>
              </div>

              <div className="mb-6">
                <h5 className="text-sm font-semibold text-gray-700 mb-3">Transaction</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Transaction ID</label>
                    <input value={formData.transaction.transaction_id} onChange={(e) => updateFormField('transaction', 'transaction_id', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Release Form #</label>
                    <input value={formData.transaction.release_form_number} onChange={(e) => updateFormField('transaction', 'release_form_number', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Release Date</label>
                    <input value={formData.transaction.release_date} onChange={(e) => updateFormField('transaction', 'release_date', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Arrival Date</label>
                    <input value={formData.transaction.arrival_date} onChange={(e) => updateFormField('transaction', 'arrival_date', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h5 className="text-sm font-semibold text-gray-700 mb-3">Authorization</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Released By Name</label>
                    <input value={formData.authorization.released_by_name} onChange={(e) => updateFormField('authorization', 'released_by_name', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Released To Name</label>
                    <input value={formData.authorization.released_to_name} onChange={(e) => updateFormField('authorization', 'released_to_name', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  </div>
                </div>
              </div>

              <div>
                <h5 className="text-sm font-semibold text-gray-700 mb-3">Dealer Notes</h5>
                <textarea value={formData.dealer_notes} onChange={(e) => setFormData((prev: any) => ({ ...prev, dealer_notes: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[96px]" />
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={() => {
                clearPersisted();
                setUploadedFiles([]);
                setSubmitMessage(null);
                setSubmitError(false);
                setReceiptText(null);
                setIsReceiptOpen(false);
                setFormData(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Clear All
            </button>
            <button
              onClick={handleSubmitDocuments}
              disabled={isSubmitting}
              className="px-6 py-3 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : formData ? 'Submit Document' : 'Extract Document'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
