import { AnimatePresence, motion } from "framer-motion";

const AnimatedTabs = ({ children, selected }: { children: React.ReactElement[], selected: React.Key }) => {
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
