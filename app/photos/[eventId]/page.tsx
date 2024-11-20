'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';
import ProfilePopover from '@/components/ProfilePopover';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

interface Photo {
  id: number;
  created_at: string;
  blob_id: string;
  object_id: string;
  event_id: number;
  user: string | null;
}

export default function PhotosPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const resolvedParams = use(params);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPhotos = async () => {
      const { data, error } = await supabase
        .from('photos')
        .select('blob_id, object_id, event_id')
        .eq('event_id', resolvedParams.eventId);

      if (error) {
        setError(error);
        console.error('Error fetching photos:', error);
      } else {
        setPhotos((data as Photo[]) || []);
      }
    };

    fetchPhotos();
  }, [resolvedParams.eventId]);

  useEffect(() => {
    const fetchEventDetails = async () => {
      const { data: events, error } = await supabase
        .from('events')
        .select('created_at, event_title')
        .eq('id', resolvedParams.eventId);

      if (error) {
        setError(error);
        console.error('Error fetching event name:', error);
      } else {
        const [et, ed] = [events[0].event_title, events[0].created_at];
        setEventTitle(et);
        setEventDate(ed);
      }
    };

    fetchEventDetails();
  }, [resolvedParams.eventId]);

  if (error) {
    return <div>Error loading photos</div>;
  }

  return (
    <main className='container mx-auto px-4 py-8'>
      <div className='w-full flex items-center justify-between relative mb-10'>
        <div>
          <h1 className='text-3xl font-bold'>{eventTitle.toUpperCase()}</h1>
          <h2 className='text-xl font-bold'>
            {new Date(eventDate).toString()}
          </h2>
          <Link href='/' className='underline'>
            Back to Events
          </Link>
        </div>
        <ProfilePopover />
      </div>

      {photos.length === 0 ? (
        <p>No photos found for this event.</p>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {photos.map((photo) => (
            <div key={photo.blob_id} className='border rounded-lg p-4'>
              <Image
                src={`https://aggregator.walrus-testnet.walrus.space/v1/${photo.blob_id}`}
                alt={`Photo ${photo.blob_id}`}
                className='w-full h-48 object-cover mb-4 rounded'
                width={500}
                height={300}
              />
              <p className='text-sm mb-2'>Blob ID: {photo.blob_id}</p>
              <p className='text-sm mb-2'>
                Object ID:{' '}
                <Link
                  href={`https://suiscan.xyz/testnet/object/${photo.object_id}`}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-blue-500 hover:underline'
                >
                  {photo.object_id}
                </Link>
              </p>
              <p className='text-sm'>
                Event: {photo.event_id || 'No event specified'}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}