import { useState, useEffect } from "react";

export const STUDY_MATERIALS = {
  Math: {
    video: "https://www.youtube.com/embed/mjlsSYLLOSE",
    article: {
      title: "Fundamentals of Arithmetic",
      content: [
        "Addition and subtraction are the most basic operations in math. Addition combines quantities, like finding the total of 5 + 7, which equals 12. It's like putting two groups of items together. Subtraction is the opposite; it's about taking away. For example, 9 - 4 means we start with 9 items and remove 4, leaving us with 5. These operations are fundamental to everyday calculations, from managing money to tracking time.",
        "Multiplication is essentially a shortcut for repeated addition. When we calculate 6 × 7, we are really adding 6 to itself 7 times (or vice-versa), which gives us 42. It's a powerful tool for scaling numbers and calculating areas. For instance, if a garden has 6 rows of 7 plants each, you can quickly find the total number of plants by multiplying. Mastering multiplication tables is a key step in becoming fluent in mathematics.",
        "Division is the process of splitting a number into equal parts or groups. It answers the question, 'How many times does one number fit into another?' For example, 56 ÷ 8 asks how many groups of 8 we can make from 56. The answer is 7. Division is the inverse of multiplication, just as subtraction is the inverse of addition. It's used for sharing, distributing items evenly, and calculating rates like speed (distance divided by time)."
      ]
    }
  },
  Science: {
    video: "https://youtube.com/embed/8vo59AKzU4Q",
    article: {
      title: "Essentials of Life Science",
      content: [
        "Water is a unique substance with special properties essential for life. One of its most well-known properties is its change of state based on temperature. At sea level, pure water freezes into ice at 0° Celsius (32° Fahrenheit). When heated, its temperature rises until it reaches its boiling point at 100° Celsius (212° Fahrenheit), at which point it turns into steam. These precise temperatures are key reference points in science.",
        "Plants play a crucial role in our planet's ecosystem through a process called photosynthesis. They absorb carbon dioxide (CO2) from the atmosphere, along with water from the soil and energy from the sun. Using these ingredients, they create glucose (their food) and release oxygen as a byproduct. This is why forests are often called the 'lungs of the planet'—they take in the CO2 we exhale and produce the oxygen we need to breathe.",
        "Our planet, Earth, is the third planet from the Sun, located in a region called the 'habitable zone' where conditions are just right for liquid water and life. Humans, like all animals, depend on the oxygen produced by plants. Our respiratory system is designed to breathe in oxygen, which our bodies use to convert food into energy, and we exhale carbon dioxide as a waste product, completing a vital cycle with plants."
      ]
    }
  },
  English: {
    video: "https://youtube.com/embed/e_04ZrNroTo",
    article: {
      title: "Building Blocks of English",
      content: [
        "Words can have similar or opposite meanings. A 'synonym' is a word that means the same or nearly the same as another word. For example, 'joyful' is a synonym for 'happy.' An 'antonym' is a word with the opposite meaning. The antonym of 'begin' is 'end.' Expanding your knowledge of synonyms and antonyms is a great way to make your writing and speaking more precise and interesting.",
        "Verbs are action words, but they change form depending on the subject and tense. For subjects like 'he,' 'she,' or 'it,' we often add an '-s' to the verb in the present tense, so 'she goes to school' is correct. The 'tense' of a verb tells us when the action happened. The past tense of 'eat' is 'ate.' Understanding these rules is crucial for forming clear and grammatically correct sentences.",
        "Nouns are words for people, places, or things. Most nouns can be made plural to show there is more than one. While many nouns just add an '-s,' some are irregular. The plural of 'child' is not 'childs,' but 'children.' Learning these irregular plurals is a common step in mastering English grammar and helps avoid simple mistakes in writing."
      ]
    }
  },
  GK: {
    video: "https://youtube.com/embed/xzZLdYd78_8",
    article: {
      title: "A Glimpse of Our World",
      content: [
        "Every country has a capital city that serves as the center of its government. The capital of India is New Delhi, which is part of the larger metropolis of Delhi. On a global scale, our planet is divided into large landmasses called continents. There are seven continents in total: Asia, Africa, North America, South America, Antarctica, Europe, and Australia (sometimes called Oceania).",
        "Earth's surface is mostly covered by water, which is divided into five major oceans. The largest and deepest of these is the Pacific Ocean. Our planet also features incredible mountain ranges. The tallest mountain on Earth is Mount Everest, located in the Himalayas. Its peak reaches an astonishing 8,848 meters (29,032 feet) above sea level, making it the highest point on the planet.",
        "Countries often have national symbols that represent their identity, history, and wildlife. These symbols can include a national bird, flower, or animal. The national animal of India is the majestic Tiger. Known for its power, grace, and distinctive orange coat with black stripes, the tiger is a powerful symbol of the country's rich natural heritage and conservation efforts."
      ]
    }
  }
};

export function useClassDataStream() {
  const [students, setStudents] = useState([
    { name: "Alice", attention: 76, status: "Focused" },
    { name: "Bob", attention: 62, status: "Engaged" },
    { name: "Charlie", attention: 89, status: "Focused" },
    { name: "David", attention: 35, status: "Distracted" },
    { name: "Eve", attention: 92, status: "Focused" },
  ]);
  useEffect(() => {
    const interval = setInterval(() => {
      setStudents(prevStudents => prevStudents.map(s => {
        const drift = (Math.random() - 0.45) * 10;
        const newAttention = Math.max(10, Math.min(100, s.attention + drift));
        const status = newAttention > 65 ? "Focused" : newAttention > 40 ? "Engaged" : "Distracted";
        return { ...s, attention: newAttention, status };
      }));
    }, 2500);
    return () => clearInterval(interval);
  }, []);
  return students;
}
