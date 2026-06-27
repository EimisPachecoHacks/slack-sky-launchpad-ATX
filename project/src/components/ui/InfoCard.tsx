import React from 'react';
import { Lightbulb } from 'lucide-react';
import Card from './Card';
import '../../styles/design-tokens.css';

interface InfoCardProps {
  title: string;
  items: string[];
}

/**
 * InfoCard Component
 *
 * Displays informational content with an icon and list of items.
 * Commonly used for "How it works" or instructional sections.
 *
 * @param title - The card title
 * @param items - Array of information items to display
 *
 * @example
 * <InfoCard
 *   title="How it works"
 *   items={[
 *     "1. Upload: Provide a clear image",
 *     "2. Analyze: AI identifies components",
 *     "3. Generate: Creates infrastructure code"
 *   ]}
 * />
 */
const InfoCard: React.FC<InfoCardProps> = ({ title, items }) => {
  return (
    <Card variant="glass" className="p-6 upload-card-dark">
      <div className="flex items-start space-x-3">
        <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
          <Lightbulb className="w-4 h-4 text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-lg mb-4 text-white">{title}</h3>
          <ol className="space-y-3 text-gray-300">
            {items.map((item, index) => (
              <li key={index} className="flex items-start">
                {item.includes(':') ? (
                  <>
                    <span className="font-bold mr-2 text-white">
                      {item.split(':')[0]}:
                    </span>
                    <span>{item.split(':')[1]}</span>
                  </>
                ) : (
                  <span>{item}</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Card>
  );
};

export default InfoCard;
