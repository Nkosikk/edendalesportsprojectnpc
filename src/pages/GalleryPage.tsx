import { useState } from 'react';
import { Play, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface MediaItem {
  id: number;
  type: 'image' | 'video';
  src: string;
  thumbnail?: string;
  title: string;
}

const mediaItems: MediaItem[] = [
  { id: 1, type: 'image', src: '/images/field1.jpeg', title: 'Sports Field View 1' },
  { id: 2, type: 'image', src: '/images/field2.jpeg', title: 'Sports Field View 2' },
  { id: 3, type: 'video', src: '/images/field3.mp4', title: 'Field Video Tour 1' },
  { id: 4, type: 'video', src: '/images/field4.mp4', title: 'Field Video Tour 2' },
  { id: 5, type: 'video', src: '/images/field5.mp4', title: 'Field Video Tour 3' },
];

const GalleryPage = () => {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [filter, setFilter] = useState<'all' | 'images' | 'videos'>('all');

  const filteredItems = mediaItems.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'images') return item.type === 'image';
    if (filter === 'videos') return item.type === 'video';
    return true;
  });

  const openLightbox = (item: MediaItem) => {
    setSelectedMedia(item);
  };

  const closeLightbox = () => {
    setSelectedMedia(null);
  };

  const goToNext = () => {
    if (!selectedMedia) return;
    const currentIndex = filteredItems.findIndex(item => item.id === selectedMedia.id);
    const nextIndex = (currentIndex + 1) % filteredItems.length;
    setSelectedMedia(filteredItems[nextIndex]);
  };

  const goToPrevious = () => {
    if (!selectedMedia) return;
    const currentIndex = filteredItems.findIndex(item => item.id === selectedMedia.id);
    const prevIndex = (currentIndex - 1 + filteredItems.length) % filteredItems.length;
    setSelectedMedia(filteredItems[prevIndex]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-primary-50">
      {/* Minimal Header */}
      <div className="bg-gradient-to-r from-primary-600 via-blue-600 to-primary-800 text-white py-4">
        <div className="relative max-w-full mx-auto px-2 sm:px-4 lg:px-6">
          <div className="text-center">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-1">
              <span className="bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
                Fields Gallery
              </span>
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Enhanced Filter Buttons */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-8 sm:mb-12 px-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-sm sm:text-base rounded-full font-semibold transition-all duration-300 transform active:scale-95 hover:scale-105 ${
              filter === 'all'
                ? 'bg-gradient-to-r from-primary-600 to-blue-600 text-white shadow-lg shadow-primary-500/25'
                : 'bg-white text-gray-600 hover:bg-gray-50 border-2 border-gray-200 hover:border-primary-300 shadow-sm'
            }`}
          >
            <span className="hidden sm:inline">🎬 All ({mediaItems.length})</span>
            <span className="sm:hidden">All</span>
          </button>
          <button
            onClick={() => setFilter('images')}
            className={`px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-sm sm:text-base rounded-full font-semibold transition-all duration-300 transform active:scale-95 hover:scale-105 ${
              filter === 'images'
                ? 'bg-gradient-to-r from-primary-600 to-blue-600 text-white shadow-lg shadow-primary-500/25'
                : 'bg-white text-gray-600 hover:bg-gray-50 border-2 border-gray-200 hover:border-primary-300 shadow-sm'
            }`}
          >
            <span className="hidden sm:inline">📸 Photos ({mediaItems.filter(i => i.type === 'image').length})</span>
            <span className="sm:hidden">Photos</span>
          </button>
          <button
            onClick={() => setFilter('videos')}
            className={`px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-sm sm:text-base rounded-full font-semibold transition-all duration-300 transform active:scale-95 hover:scale-105 ${
              filter === 'videos'
                ? 'bg-gradient-to-r from-primary-600 to-blue-600 text-white shadow-lg shadow-primary-500/25'
                : 'bg-white text-gray-600 hover:bg-gray-50 border-2 border-gray-200 hover:border-primary-300 shadow-sm'
            }`}
          >
            <span className="hidden sm:inline">🎥 Videos ({mediaItems.filter(i => i.type === 'video').length})</span>
            <span className="sm:hidden">Videos</span>
          </button>
        </div>

        {/* Enhanced Gallery Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {filteredItems.map((item, index) => (
            <div
              key={item.id}
              onClick={() => openLightbox(item)}
              className="relative group cursor-pointer rounded-xl sm:rounded-2xl overflow-hidden shadow-lg hover:shadow-xl sm:shadow-xl sm:hover:shadow-2xl transition-all duration-300 sm:duration-500 transform hover:-translate-y-1 sm:hover:-translate-y-2 active:scale-95 sm:hover:scale-105 bg-white touch-manipulation"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Premium border gradient - only on hover for desktop */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary-500 via-blue-500 to-purple-500 rounded-xl sm:rounded-2xl opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300 p-1">
                <div className="w-full h-full bg-white rounded-lg sm:rounded-xl"></div>
              </div>
              
              <div className="relative z-10">
                {item.type === 'image' ? (
                  <div className="relative overflow-hidden">
                    <img
                      src={item.src}
                      alt={item.title}
                      className="w-full h-48 sm:h-56 lg:h-72 object-cover transition-transform duration-300 sm:duration-700 group-hover:scale-105 sm:group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    
                    {/* Image overlay content */}
                    <div className="absolute top-2 sm:top-4 right-2 sm:right-4">
                      <span className="bg-green-500 text-white text-xs px-2 sm:px-3 py-1 rounded-full font-semibold shadow-lg">
                        📸 PHOTO
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="relative overflow-hidden">
                    <video
                      src={item.src}
                      className="w-full h-48 sm:h-56 lg:h-72 object-cover transition-transform duration-300 sm:duration-700 group-hover:scale-105 sm:group-hover:scale-110"
                      muted
                      playsInline
                      poster={item.thumbnail}
                      onMouseEnter={(e) => {
                        e.currentTarget.play();
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.pause();
                        e.currentTarget.currentTime = 0;
                      }}
                      onTouchStart={(e) => {
                        // For touch devices
                        e.currentTarget.play();
                      }}
                      onTouchEnd={(e) => {
                        setTimeout(() => {
                          e.currentTarget.pause();
                          e.currentTarget.currentTime = 0;
                        }, 2000); // Play for 2 seconds on touch
                      }}
                    />
                    {/* Enhanced video overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40"></div>
                    
                    {/* Ultra premium play button */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="relative">
                        <div className="w-16 h-16 sm:w-20 lg:w-24 sm:h-20 lg:h-24 bg-gradient-to-r from-white to-blue-50 rounded-full flex items-center justify-center shadow-xl sm:shadow-2xl transition-all duration-300 group-hover:scale-110 sm:group-hover:scale-125 border-2 sm:border-4 border-white/30 backdrop-blur-sm touch-manipulation">
                          <Play className="w-7 h-7 sm:w-9 lg:w-12 sm:h-9 lg:h-12 text-primary-600 ml-0.5 sm:ml-1 drop-shadow-lg" />
                        </div>
                        {/* Pulse animation ring */}
                        <div className="absolute inset-0 w-16 h-16 sm:w-20 lg:w-24 sm:h-20 lg:h-24 bg-white/20 rounded-full animate-ping"></div>
                      </div>
                    </div>
                    
                    {/* Video duration badge */}
                    <div className="absolute top-2 sm:top-4 right-2 sm:right-4">
                      <span className="bg-red-500 text-white text-xs px-2 sm:px-3 py-1 rounded-full font-semibold shadow-lg animate-pulse">
                        🎥 VIDEO
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Enhanced card footer */}
                <div className="p-4 sm:p-6 bg-white">
                  <h3 className="font-bold text-base sm:text-lg text-gray-900 mb-2 group-hover:text-primary-600 transition-colors duration-300 leading-tight">
                    {item.title}
                  </h3>
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-gray-500 capitalize font-medium">
                      {item.type === 'image' ? '📸 High Quality Photo' : '🎬 HD Video Tour'}
                    </span>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full"></div>
                      <span className="text-xs text-green-600 font-semibold">Available</span>
                    </div>
                  </div>
                  
                  {/* Action hint */}
                  <div className="mt-2 sm:mt-3 text-xs text-primary-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    👆 Tap to view full screen
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12 sm:py-16">
            <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">🔍</div>
            <p className="text-gray-500 text-base sm:text-lg">No items found for this filter.</p>
            <p className="text-gray-400 text-sm mt-2">Try selecting a different category above.</p>
          </div>
        )}
        
        {/* Call to Action Section */}
        <div className="mt-12 sm:mt-16 text-center bg-gradient-to-r from-primary-50 to-blue-50 rounded-2xl sm:rounded-3xl p-6 sm:p-8 lg:p-12 mx-2 sm:mx-0">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">
            Ready to Book Your Perfect Field? 🚀
          </h2>
          <p className="text-sm sm:text-base lg:text-lg text-gray-600 mb-4 sm:mb-6 max-w-2xl mx-auto px-2">
            Experience these premium facilities in person. Book your field today and enjoy world-class sports amenities.
          </p>
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full sm:w-auto bg-gradient-to-r from-primary-600 to-blue-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full font-semibold text-base sm:text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform active:scale-95 hover:scale-105 hover:from-primary-700 hover:to-blue-700 touch-manipulation"
          >
            🏆 Book Now - Start Playing!
          </button>
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedMedia && (
        <div 
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-2 sm:p-4"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-2 sm:top-4 right-2 sm:right-4 text-white hover:text-gray-300 z-10 p-2 touch-manipulation"
          >
            <X className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>

          {/* Previous button */}
          <button
            onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
            className="absolute left-1 sm:left-4 text-white hover:text-gray-300 z-10 p-1 sm:p-2 touch-manipulation"
          >
            <ChevronLeft className="w-8 h-8 sm:w-10 sm:h-10" />
          </button>

          {/* Next button */}
          <button
            onClick={(e) => { e.stopPropagation(); goToNext(); }}
            className="absolute right-1 sm:right-4 text-white hover:text-gray-300 z-10 p-1 sm:p-2 touch-manipulation"
          >
            <ChevronRight className="w-8 h-8 sm:w-10 sm:h-10" />
          </button>

          {/* Media content */}
          <div 
            className="max-w-5xl max-h-[90vh] sm:max-h-[85vh] w-full mx-2 sm:mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedMedia.type === 'image' ? (
              <img
                src={selectedMedia.src}
                alt={selectedMedia.title}
                className="w-full h-full object-contain rounded-lg shadow-2xl max-h-[70vh] sm:max-h-[75vh]"
              />
            ) : (
              <video
                src={selectedMedia.src}
                controls
                autoPlay
                className="w-full h-full max-h-[70vh] sm:max-h-[75vh] lg:max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/10"
                style={{
                  backgroundColor: '#000'
                }}
              />
            )}
            <div className="text-center mt-2 sm:mt-4">
              <h3 className="text-white text-lg sm:text-xl font-semibold px-4">{selectedMedia.title}</h3>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GalleryPage;
