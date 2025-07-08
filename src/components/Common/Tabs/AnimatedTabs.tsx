"use client";

import { ReactElement, Key } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * AnimatedTabs component provides an animated tab-switching experience.
 *
 * Props:
 * - children: An array of React elements representing the content of each tab.
 * - selected: The key of the currently selected tab.
 *
 * The component uses AnimatePresence from framer-motion to animate the transition
 * between tabs. Only the content of the selected tab is rendered and animated.
 */
const AnimatedTabs = ({ children, selected }: { children: ReactElement[], selected: Key }) => {
    return (<AnimatePresence mode="wait" initial={false}>
        {children.map((child, index) => {
            if (child.key !== selected) return null;
            return <motion.div
                key={index}
                className="overflow-hidden opacity-0"
                initial={{ x: 500, opacity: 0, height: 256 }}
                animate={{ x: 0, opacity: 1, height: "auto" }}
                exit={{ x: -500, opacity: 0, height: 256 }}
                layout
            >
                {child}
            </motion.div>;
        })}
    </AnimatePresence>);
};

export default AnimatedTabs;
