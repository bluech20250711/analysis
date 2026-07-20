export interface ProgressStep {
  key: string;
  label: string;
}

interface GenerationProgressProps {
  steps: ProgressStep[];
  currentKey: string;
}

function GenerationProgress({ steps, currentKey }: GenerationProgressProps) {
  const currentIndex = steps.findIndex((s) => s.key === currentKey);

  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-3">
      <h2 className="text-lg font-semibold text-gray-800">생성 진행상황</h2>
      <ul className="space-y-2">
        {steps.map((step, i) => {
          const state = i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'pending';
          return (
            <li key={step.key} className="flex items-center gap-2 text-sm">
              <span
                className={
                  'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ' +
                  (state === 'done'
                    ? 'bg-green-500 text-white'
                    : state === 'active'
                      ? 'bg-blue-500 text-white animate-pulse'
                      : 'bg-gray-200 text-gray-500')
                }
              >
                {state === 'done' ? '✓' : i + 1}
              </span>
              <span className={state === 'pending' ? 'text-gray-400' : 'text-gray-800'}>{step.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default GenerationProgress;
