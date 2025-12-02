'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  Clock, 
  Sun, 
  Moon, 
  Flame,
  Star,
  Eye,
  Skull,
  Sparkles
} from 'lucide-react';

interface TimelineEra {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  events: TimelineEvent[];
}

interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  type: 'major' | 'minor' | 'mysterious';
  relatedLore?: string[];
}

const timelineData: TimelineEra[] = [
  {
    id: 'before-time',
    name: 'Before Time',
    description: 'The void before creation, when only darkness existed',
    icon: Eye,
    color: '#6b21a8',
    events: [
      {
        id: 'void',
        title: 'The Primordial Void',
        description: 'Before anything existed, there was only the endless darkness. No light, no life, no death—only the void.',
        type: 'mysterious',
      },
      {
        id: 'first-entities',
        title: 'Emergence of the First Entities',
        description: 'From the void, beings of immense power began to stir. These ancient entities would shape the world to come.',
        type: 'major',
      },
    ],
  },
  {
    id: 'golden-age',
    name: 'The Golden Age',
    description: 'A legendary era of civilization and light, now lost to time',
    icon: Sun,
    color: '#f4a342',
    events: [
      {
        id: 'civilization',
        title: 'Rise of Civilization',
        description: 'Humanity or something like it built great cities and achieved wonders. The darkness was held at bay by knowledge and power.',
        type: 'major',
      },
      {
        id: 'gold-smoke',
        title: 'The Gold Smoke Knight Appears',
        description: 'Legends speak of a being clad in golden armor, wreathed in smoke, walking among the people of this age.',
        type: 'mysterious',
        relatedLore: ['gold-smoke-knight'],
      },
      {
        id: 'decline',
        title: 'The Decline Begins',
        description: 'Something went wrong. Perhaps hubris, perhaps external forces. The Golden Age began its slow collapse.',
        type: 'major',
      },
    ],
  },
  {
    id: 'age-of-darkness',
    name: 'The Age of Darkness',
    description: 'The current era where survivors struggle against endless night',
    icon: Moon,
    color: '#3b82f6',
    events: [
      {
        id: 'fall',
        title: 'The Fall',
        description: 'Civilization collapsed. The light faded. The world was consumed by darkness, and the monsters emerged.',
        type: 'major',
      },
      {
        id: 'first-survivors',
        title: 'The First Survivors',
        description: 'Somewhere in the darkness, humans awoke with no memory. They found the Lantern Hoard and began the struggle to survive.',
        type: 'major',
        relatedLore: ['lantern-hoard', 'first-day'],
      },
      {
        id: 'settlements',
        title: 'Settlements Form',
        description: 'Around sources of light, fragile communities began to form. They hunted monsters, crafted tools, and tried to make sense of their existence.',
        type: 'major',
        relatedLore: ['people-of-the-lantern'],
      },
      {
        id: 'the-king',
        title: 'The King\'s Domain',
        description: 'Somewhere in the darkness, an entity called The King rules over a domain of twisted opulence, sending servants to collect "taxes" from prosperous settlements.',
        type: 'mysterious',
        relatedLore: ['kings-man'],
      },
      {
        id: 'philosophies',
        title: 'The Divergent Paths',
        description: 'Survivors developed different philosophies for survival—the Lantern, the Stars, the Sun—each offering different paths forward.',
        type: 'major',
        relatedLore: ['people-of-the-lantern', 'people-of-the-stars'],
      },
    ],
  },
  {
    id: 'future',
    name: 'The Unknown Future',
    description: 'What lies ahead? Only the brave will discover.',
    icon: Sparkles,
    color: '#10b981',
    events: [
      {
        id: 'watcher',
        title: 'The Watcher\'s Judgment',
        description: 'Some settlements attract the attention of the Watcher, an entity that tests humanity\'s worthiness to continue.',
        type: 'mysterious',
        relatedLore: ['watcher'],
      },
      {
        id: 'transcendence',
        title: 'Possible Transcendence',
        description: 'Rumors speak of survivors who achieved something beyond mere survival—becoming something more than human.',
        type: 'mysterious',
      },
    ],
  },
];

const eventTypeStyles = {
  major: 'border-l-[var(--lantern-glow)]',
  minor: 'border-l-[var(--text-muted)]',
  mysterious: 'border-l-[#8b5cf6]',
};

export default function TimelinePage() {
  return (
    <div className="min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <Clock className="w-12 h-12 mx-auto mb-6 text-lantern" />
          <h1 className="text-4xl md:text-5xl font-[var(--font-display)] tracking-wider mb-4">
            THE <span className="text-lantern">TIMELINE</span>
          </h1>
          <p className="text-[var(--text-secondary)] max-w-2xl mx-auto">
            A reconstruction of history from fragments, legends, and survivor accounts. 
            Much remains unknown, lost to the darkness of time.
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Central Line */}
          <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[var(--weathered-bone)]/50 to-transparent" />

          {timelineData.map((era, eraIdx) => {
            const EraIcon = era.icon;
            
            return (
              <motion.div
                key={era.id}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: eraIdx * 0.2 }}
                className="mb-16 last:mb-0"
              >
                {/* Era Header */}
                <div className="flex items-center justify-center mb-8 relative">
                  <motion.div
                    className="flex items-center gap-4 bg-abyss px-6 py-3 z-10"
                    whileHover={{ scale: 1.05 }}
                  >
                    <div 
                      className="p-3 rounded-full"
                      style={{ backgroundColor: `${era.color}20`, border: `1px solid ${era.color}` }}
                    >
                      <EraIcon className="w-6 h-6" style={{ color: era.color }} />
                    </div>
                    <div className="text-center">
                      <h2 
                        className="text-2xl font-[var(--font-display)] tracking-wider"
                        style={{ color: era.color }}
                      >
                        {era.name}
                      </h2>
                      <p className="text-sm text-[var(--text-muted)]">
                        {era.description}
                      </p>
                    </div>
                  </motion.div>
                </div>

                {/* Era Events */}
                <div className="space-y-6 ml-16 md:ml-0">
                  {era.events.map((event, eventIdx) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: eventIdx % 2 === 0 ? -20 : 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.1 * eventIdx }}
                      className={`relative md:w-[calc(50%-2rem)] ${
                        eventIdx % 2 === 0 ? 'md:mr-auto md:pr-8' : 'md:ml-auto md:pl-8'
                      }`}
                    >
                      {/* Connection Dot */}
                      <div 
                        className={`absolute ${
                          eventIdx % 2 === 0 
                            ? 'left-[-2.5rem] md:left-auto md:right-[-1rem]' 
                            : 'left-[-2.5rem] md:left-[-1rem]'
                        } top-4 w-3 h-3 rounded-full border-2 bg-abyss`}
                        style={{ borderColor: era.color }}
                      />

                      {/* Event Card */}
                      <div className={`lore-card p-5 border-l-2 ${eventTypeStyles[event.type]}`}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-[var(--font-display)] tracking-wider">
                            {event.title}
                          </h3>
                          {event.type === 'mysterious' && (
                            <Eye className="w-4 h-4 text-purple-400 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] mb-3">
                          {event.description}
                        </p>
                        
                        {event.relatedLore && event.relatedLore.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {event.relatedLore.map(loreId => (
                              <Link
                                key={loreId}
                                href={`/lore/${loreId}`}
                                className="tag hover:border-lantern hover:text-lantern transition-colors"
                              >
                                View Lore
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Footer Note */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-20 text-center"
        >
          <div className="divider mb-8" />
          <p className="text-[var(--text-muted)] italic max-w-xl mx-auto">
            "Time has no meaning in the darkness. We measure our existence in lantern years, 
            in hunts survived, in children born. The past is a dream; the future, a hope."
          </p>
          <p className="text-lantern font-[var(--font-display)] tracking-wider mt-4">
            — Settlement Chronicle
          </p>
        </motion.div>
      </div>
    </div>
  );
}

