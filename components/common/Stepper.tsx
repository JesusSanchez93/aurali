import { Check } from "lucide-react";


interface StepperProps {
    steps: string[];
    currentStep: number;
}


export default function Stepper({ steps, currentStep }: StepperProps) {
    return (
        <div>
            <div className="w-full flex items-center justify-between">
                {steps.map((step, index) => {

                    const beforeCurrentStepIsCompleted = index - 1 < currentStep;
                    const isCompleted = index < currentStep;
                    const isActive = index === currentStep;

                    return (
                        <div key={index} className="flex items-center w-full">
                            {index === 0 && <div className="flex-1" />}
                            {/* Line */}
                            {(index !== 0) && (
                                <div className={`flex-1 h-0.5 transition-all ${beforeCurrentStepIsCompleted ? "bg-green-500" : "bg-gray-300"}`} />
                            )}

                            <div className="flex flex-col items-center gap-2 relative">
                                {/* Step circle */}
                                <div
                                    className={
                                        `flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all 
                                        ${isCompleted ? "" : "mx-2"}
                                    ${isCompleted ? "bg-green-500 border-green-500 text-white" : ""}
                                    ${isActive ? "border-blue-500 text-blue-500" : "border-gray-300 text-gray-400"}`}
                                >
                                    {isCompleted ? <Check size={18} /> : index + 1}
                                </div>
                            </div>

                            {/* Line */}
                            {index !== steps.length - 1 && (
                                <div className={`flex-1 h-0.5 transition-all ${isCompleted ? "bg-green-500" : "bg-gray-300"}`} />
                            )}

                            {/* Line */}
                            {index === steps.length - 1 && <div className="flex-1" />}
                        </div>
                    );
                })}
            </div>
            <div className="w-full flex items-center justify-between">
                {steps.map((step, index) => {
                    const isCompleted = index < currentStep;
                    const isActive = index === currentStep;
                    return (
                        <div key={index} className="flex justify-center items-center w-full">
                            <div className="flex flex-col items-center gap-2">
                                <div className="text-sm font-medium text-center">
                                    <p className={isActive ? "text-blue-600" : "text-gray-500"}>
                                        {step}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}