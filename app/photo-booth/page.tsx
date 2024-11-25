'use client';

import { useState, useEffect } from 'react';
import { useCustomWallet } from '@/contexts/CustomWallet';
import { createClient } from '@supabase/supabase-js';
import PhotoBooth from '@/components/PhotoBooth';
import Loading from '@/components/Loading';
import ProfilePopover from '@/components/ProfilePopover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

interface Event {
  id: number;
  created_at: string;
  event_title: string;
  event_date: string;
  admin_id: number;
}

const PhotoBoothPage: React.FC = () => {
  const { isConnected, emailAddress } = useCustomWallet();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [currentAdminId, setCurrentAdminId] = useState<number | null>(null);
  const [currAdminsEvents, setCurrAdminsEvents] = useState<Event[]>([]);

  const [selectedEvent, setSelectedEvent] = useState(() => {
    if (typeof window !== 'undefined') {
      const jsonStr = localStorage.getItem('selectedEvent');

      if (jsonStr !== null) {
        return JSON.parse(jsonStr);
      }
      return null;
    }
    return null;
  });

  // const [showAdminButtons, setShowAdminButtons] = useState(false);
  // const [typedText, setTypedText] = useState<string>('');

  // useEffect(() => {
  //   const handleKeyPress = (e: KeyboardEvent) => {
  //     const newText = typedText + e.key;
  //     setTypedText(newText);

  //     const lastChars = newText.slice(-8);
  //     if (lastChars === 'admin') {
  //       // setShowAdminButtons(true);
  //       setTypedText('');
  //     }

  //     if (newText.length > 20) {
  //       setTypedText('');
  //     }
  //   };

  //   window.addEventListener('keypress', handleKeyPress);
  //   return () => window.removeEventListener('keypress', handleKeyPress);
  // }, [typedText]);

  useEffect(() => {
    const fetchCurrentAdmin = async () => {
      setIsLoading(true);

      const { data: admins, error } = await supabase
        .from('admins')
        .select('id')
        .eq('email', emailAddress);

      if (error) {
        setError(error);
        console.error('Error fetching admin info:', error);
      } else {
        if (admins[0]) setCurrentAdminId(admins[0].id);
      }

      setIsLoading(false);
    };

    fetchCurrentAdmin();
  }, [emailAddress]);

  useEffect(() => {
    const fetchCurrentAdminsEvents = async () => {
      setIsLoading(true);

      if (currentAdminId) {
        const { data: events, error } = await supabase
          .from('events')
          .select('*')
          .eq('admin_id', currentAdminId);

        if (error) {
          setError(error);
          console.error("Error fetching current admin's events:", error);
        } else {
          setCurrAdminsEvents((events as Event[]) || []);
        }
      }

      setIsLoading(false);
    };

    fetchCurrentAdminsEvents();
  }, [currentAdminId]);

  const handleSelectEvent = (e: string) => {
    const eNum = parseInt(e);
    const foundEvent = currAdminsEvents.filter((e) => e.id === eNum);
    localStorage.setItem('selectedEvent', JSON.stringify(foundEvent[0]));
    localStorage.setItem('camActivated', 'true');
    setSelectedEvent(foundEvent[0]);
  };

  const handleEditCam = () => {
    setIsLoading(true);
    localStorage.setItem('camActivated', JSON.stringify(false));
    localStorage.removeItem('selectedEvent');
    setSelectedEvent(null);
    setIsLoading(false);
  };

  if (error) {
    return <div>Error loading events</div>;
  }

  if (isLoading) {
    return <Loading />;
  }

  if (!isConnected && !selectedEvent) {
    return (
      <main className='container mx-auto'>
        <div className='min-h-screen w-full flex items-center justify-center p-4 relative'>
          <ProfilePopover />
        </div>
      </main>
    );
  }

  return (
    <main className='container min-h-screen mx-auto px-4 py-8 flex flex-col'>
      <div className='w-full flex items-center justify-center p-4 gap-3'>
        {isConnected && !selectedEvent && (
          <Link
            href='/'
            className='flex items-center justify-center rounded-md text-sm text-white bg-gray-500 py-2 px-6'
          >
            Events
          </Link>
        )}
        <ProfilePopover />
        {isConnected && selectedEvent && (
          <Button variant='destructive' onClick={handleEditCam}>
            Deactivate Cam / Change Event
          </Button>
        )}
      </div>
      <div className='w-full flex items-center justify-center grow p-4'>
        {selectedEvent ? (
          <PhotoBooth
            selectedEventTitle={selectedEvent.event_title}
            selectedEventId={selectedEvent.id}
          />
        ) : (
          <Select onValueChange={handleSelectEvent}>
            <SelectTrigger className='w-[200px]'>
              <SelectValue placeholder='Select an Event' />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {currAdminsEvents &&
                  currAdminsEvents.map((el: Event, index) => (
                    <SelectItem key={index} value={el.id.toString()}>
                      {el.event_title.toUpperCase()} / {el.event_date}
                    </SelectItem>
                  ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
      </div>
    </main>
  );
};

export default PhotoBoothPage;
