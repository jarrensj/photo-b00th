'use client';

import React, { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Camera, Copy, Download, Upload, Check, XCircle, Loader2 } from "lucide-react";
import JSConfetti from 'js-confetti';
import Draggable, { DraggableEvent, DraggableData } from "react-draggable";
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey);

const overlayImages = [
  { id: 1, src: "/unicorn.png", name: "Unicorn" },
];

interface Overlay {
  id: number;
  src: string;
  position: { x: number; y: number };
  text?: string;
}

interface DraggableOverlayProps {
  id: number;
  src: string;
  position: { x: number; y: number };
  onDrag: (e: DraggableEvent, data: DraggableData) => void;
  onRemove: () => void;
}

const DraggableOverlay = ({ src, id, position, onDrag, onRemove }: DraggableOverlayProps) => {
  const nodeRef = useRef(null);
  
  return (
    <Draggable
      position={position}
      onStop={onDrag}
      bounds="parent"
      nodeRef={nodeRef}
    >
      <div className="absolute cursor-move" ref={nodeRef}>
        <div className="relative">
          <Image src={src} alt={`Overlay ${id}`} width={64} height={64} />
          <button
            onClick={() => onRemove()}
            className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1"
          >
            <XCircle className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </Draggable>
  );
};

const PhotoBooth: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [downloadFeedback, setDownloadFeedback] = useState(false);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const jsConfettiRef = useRef<JSConfetti | null>(null);
  const [uploadResult, setUploadResult] = useState<{
    blobId: string;
    objectId: string;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    jsConfettiRef.current = new JSConfetti();
    return () => {
      jsConfettiRef.current = null;
    };
  }, []);

  const startCamera = async () => {
    if (videoRef.current) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      setIsCameraOn(true);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      setIsCameraOn(false);
    }
  };

  const addOverlay = (src: string) => {
    setOverlays([
      ...overlays,
      { id: Date.now(), src, position: { x: 0, y: 0 } },
    ]);
    // update canvas with the new overlay
    if (canvasRef.current && photoURL) {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        const img = new window.Image();
        img.src = photoURL;
        img.onload = () => {
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
      }
    }
  };

  const takePhoto = () => {
    if (jsConfettiRef.current) {
      jsConfettiRef.current.addConfetti({
        emojis: ['📷'],
        emojiSize: 100,
        confettiNumber: 24,
      });
    }
    
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;

        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

        // clear overlays
        setOverlays([]);

        setTimeout(() => {
          setPhotoURL(canvas.toDataURL('image/png'));
        }, 200);
      }
    }
  };

  const renderOverlaysToCanvas = async (canvas: HTMLCanvasElement, basePhotoURL: string) => {
    const context = canvas.getContext('2d');
    if (!context) return;

    // draw the base photo
    const baseImage = new window.Image();
    baseImage.src = basePhotoURL;
    
    await new Promise((resolve) => {
      baseImage.onload = () => {
        context.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
        resolve(null);
      };
    });

    // draw all overlays
    await Promise.all(overlays.map((overlay) => {
      return new Promise((resolve) => {
        const overlayImg = new window.Image();
        overlayImg.src = overlay.src;
        overlayImg.onload = () => {
          context.drawImage(overlayImg, overlay.position.x, overlay.position.y, 64, 64);
          resolve(null);
        };
      });
    }));
  };

  const copyPhoto = async () => {
    if (canvasRef.current && photoURL) {
      try {
        await renderOverlaysToCanvas(canvasRef.current, photoURL);
        const dataUrl = canvasRef.current.toDataURL('image/png');
        const blob = await fetch(dataUrl).then(res => res.blob());
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob,
          }),
        ]);
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
      } catch (err) {
        console.error('Error copying image:', err);
      }
    }
  };

  const downloadImage = async () => {
    if (!canvasRef.current || !photoURL) return;
    
    await renderOverlaysToCanvas(canvasRef.current, photoURL);

    // create and trigger download
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "image.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloadFeedback(true);
    setTimeout(() => setDownloadFeedback(false), 2000);
  };

  const uploadPhoto = async () => {
    if (!canvasRef.current) return;
    setIsUploading(true);

    try {
      const imageDataUrl = canvasRef.current.toDataURL('image/png');
      const blob = await fetch(imageDataUrl).then(res => res.blob());

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: blob,
      });
      
      if (!response.ok) {
        console.error('Failed to upload image:', response.statusText);
        return;
      }
      
      const result = await response.json();
      
      if (result?.data?.newlyCreated?.blobObject) {
        // save to supabase
        const { error } = await supabase
          .from('photos')
          .insert([{
            blob_id: result.data.newlyCreated.blobObject.blobId,
            object_id: result.data.newlyCreated.blobObject.id,
            created_at: new Date().toISOString()
          }]);

        if (error) {
          console.error('Error saving to Supabase:', error);
          throw new Error('Failed to save to database');
        }

        setUploadResult({
          blobId: result.data.newlyCreated.blobObject.blobId,
          objectId: result.data.newlyCreated.blobObject.id
        });
      } else {
        console.error('Unexpected response structure:', result);
      }
    } catch (err) {
      console.error('Error uploading image:', err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-800 rounded-xl shadow-2xl overflow-hidden">
        <div className="p-4 space-y-4">
          <div className="flex space-x-2">
            <Button
              onClick={isCameraOn ? stopCamera : startCamera}
              variant={isCameraOn ? "destructive" : "default"}
            >
              <Camera className="mr-2 h-4 w-4" />
              {isCameraOn ? 'Stop Camera' : 'Start Camera'}
            </Button>
            <Button
              onClick={takePhoto}
              disabled={!isCameraOn}
              variant="secondary"
            >
              <Camera className="mr-2 h-4 w-4" />
              Take Photo
            </Button>
          </div>
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              hidden={!isCameraOn}
              className="w-full h-full object-cover"
            />
            {!isCameraOn && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-zinc-600 text-lg">Camera Preview</span>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <div className="space-y-2">
            <h3 className="text-white text-sm font-medium">Add Overlays</h3>
            <div className="flex flex-wrap gap-2">
              {overlayImages.map((overlay) => (
                <Button
                  key={overlay.id}
                  onClick={() => addOverlay(overlay.src)}
                  variant="outline"
                  size="sm"
                  className="bg-zinc-700 hover:bg-zinc-600"
                >
                  <Image
                    src={overlay.src}
                    alt={overlay.src}
                    width={24}
                    height={24}
                    className="mr-2"
                  />
                  {overlay.name}
                </Button>
              ))}
            </div>
          </div>
          {photoURL && (
            <div className="space-y-4">
              <div className="relative aspect-video bg-zinc-900 rounded-lg overflow-hidden">
                <Image
                  src={photoURL}
                  alt="Captured"
                  fill
                  className="object-contain"
                />
                {overlays.map((overlay) => (
                  <DraggableOverlay
                    key={overlay.id}
                    id={overlay.id}
                    src={overlay.src}
                    position={overlay.position}
                    onDrag={(e, data) => {
                      const updatedOverlays = overlays.map((o) =>
                        o.id === overlay.id
                          ? { ...o, position: { x: data.x, y: data.y } }
                          : o
                      );
                      setOverlays(updatedOverlays);
                    }}
                    onRemove={() => setOverlays(overlays.filter(o => o.id !== overlay.id))}
                  />
                ))}
              </div>
              <div className="flex justify-between gap-2">
                <Button onClick={copyPhoto} variant="outline" size="sm">
                  {copyFeedback ? (
                    <Check className="mr-2 h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  {copyFeedback ? "Copied!" : "Copy"}
                </Button>
                <Button onClick={downloadImage} variant="outline" size="sm">
                  {downloadFeedback ? (
                    <Check className="mr-2 h-4 w-4 text-green-500" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {downloadFeedback ? "Downloaded!" : "Download"}
                </Button>
                <Button 
                  onClick={uploadPhoto} 
                  variant="outline" 
                  size="sm"
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {isUploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </div>
          )}
          {uploadResult && (
            <div className="mt-2 text-sm text-zinc-400">
              <p>Blob ID: {uploadResult.blobId}</p>
              <p>
                Object ID:{' '}
                <Link
                  href={`https://suiscan.xyz/testnet/object/${uploadResult.objectId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  {uploadResult.objectId}
                </Link>
              </p>
            </div>
          )}
        </div>
        <div className="bg-zinc-900 text-zinc-400 text-center py-2 text-sm font-bold tracking-wider">
          photo booth
        </div>
      </div>
    </div>
  );
};

export default PhotoBooth;
