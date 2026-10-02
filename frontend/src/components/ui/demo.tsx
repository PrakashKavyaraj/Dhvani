"use client";

import { ExpandableCard } from "@/components/ui/expandable-card";

export default function ExpandableCardDemo() {
  return (
    <ExpandableCard
      title="Digital Revolution"
      src="https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80"
      description="The Future of Technology"
      classNameExpanded="[&_h4]:text-black dark:[&_h4]:text-white [&_h4]:font-medium"
    >
      <h4>The Rise of Artificial Intelligence</h4>
      <p>
        In the heart of Silicon Valley, a revolution is quietly unfolding. 
        Artificial Intelligence, once the stuff of science fiction, has become 
        the driving force behind the most transformative technologies of our 
        time. From autonomous vehicles navigating city streets to AI-powered 
        medical diagnostics saving lives, the boundaries between human and 
        machine intelligence are blurring in ways we never imagined possible.
      </p>
      <h4>The Quantum Computing Breakthrough</h4>
      <p>
        Deep within the research labs of tech giants and universities, 
        scientists are racing to harness the power of quantum mechanics. 
        Quantum computers, with their ability to process information in 
        multiple states simultaneously, promise to solve problems that 
        would take classical computers millennia to crack. From drug 
        discovery to climate modeling, the applications are limitless. 
        The first commercially viable quantum computer could revolutionize 
        cryptography, financial modeling, and our understanding of the 
        universe itself.
      </p>
      <h4>The Internet of Everything</h4>
      <p>
        Our world is becoming increasingly connected. Smart cities are 
        emerging, where traffic lights communicate with cars, streetlights 
        adjust based on pedestrian flow, and waste management systems 
        optimize collection routes in real-time. The Internet of Things 
        (IoT) is evolving into the Internet of Everything, creating a 
        seamless network of devices, sensors, and systems that work 
        together to make our lives more efficient and sustainable.
      </p>
      <h4>The Future of Human-Machine Collaboration</h4>
      <p>
        As we stand on the precipice of this technological revolution, 
        the question isn't whether machines will replace humans, but 
        how we can best collaborate with them. Augmented reality is 
        enhancing our perception of the world, while brain-computer 
        interfaces are creating new ways for us to interact with 
        technology. The future belongs to those who can harness the 
        power of human creativity and machine precision, working 
        together to solve the greatest challenges facing humanity.
      </p>
    </ExpandableCard>
  );
}
