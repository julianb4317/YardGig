"use client";

/**
 * Category-specific detail fields that appear conditionally based on selected job categories.
 * Stored as a JSON blob on the job. Each category has its own section with relevant fields.
 */

export interface JobDetails {
  mowing?: {
    yardSize?: string;
    areas?: string;
    obstacles?: string;
    grassHeight?: string;
  };
  hedging?: {
    hedgeCount?: string;
    averageHeight?: string;
    sidesToTrim?: string;
    debrisRemoval?: boolean;
  };
  leaf_removal?: {
    yardSize?: string;
    coverage?: string;
    preference?: string;
    gutterCleaning?: boolean;
  };
  snow_clearing?: {
    areaToClear?: string;
    snowDepth?: string;
    surfaceType?: string;
    saltTreatment?: boolean;
  };
  general?: {
    specificTasks?: string;
    estimatedArea?: string;
    equipmentNeeded?: string;
  };
}

interface CategoryDetailsFieldsProps {
  categories: string[];
  value: JobDetails;
  onChange: (details: JobDetails) => void;
  readOnly?: boolean;
}

const YARD_SIZES = ["Small (under 2,000 sq ft)", "Medium (2,000–5,000 sq ft)", "Large (5,000–10,000 sq ft)", "XL (over 10,000 sq ft)"];
const GRASS_HEIGHTS = ["Normal (under 4 inches)", "Overgrown (4–8 inches)", "Very overgrown (8+ inches)"];
const HEDGE_HEIGHTS = ["Under 4 feet", "4–8 feet", "Over 8 feet"];
const SNOW_DEPTHS = ["Light (1–3 inches)", "Moderate (3–6 inches)", "Heavy (6–12 inches)", "Very heavy (12+ inches)"];
const COVERAGE_LEVELS = ["Light (scattered leaves)", "Moderate (partial coverage)", "Heavy (full coverage)"];

export function CategoryDetailsFields({ categories, value, onChange, readOnly = false }: CategoryDetailsFieldsProps) {
  if (categories.length === 0) return null;

  const update = (category: keyof JobDetails, field: string, val: string | boolean) => {
    onChange({
      ...value,
      [category]: { ...(value[category] as Record<string, unknown> ?? {}), [field]: val },
    });
  };

  return (
    <div className="space-y-4">
      {categories.includes("mowing") && (
        <FieldSection title="🌿 Mowing Details" readOnly={readOnly}>
          <SelectField label="Yard Size" options={YARD_SIZES} value={value.mowing?.yardSize} onChange={(v) => update("mowing", "yardSize", v)} readOnly={readOnly} />
          <SelectField label="Areas to Mow" options={["Front yard only", "Back yard only", "Front and back", "Full property"]} value={value.mowing?.areas} onChange={(v) => update("mowing", "areas", v)} readOnly={readOnly} />
          <SelectField label="Grass Height" options={GRASS_HEIGHTS} value={value.mowing?.grassHeight} onChange={(v) => update("mowing", "grassHeight", v)} readOnly={readOnly} />
          <SelectField label="Obstacles" options={["None", "Some trees/beds", "Many obstacles (trees, beds, slopes)", "Fenced areas"]} value={value.mowing?.obstacles} onChange={(v) => update("mowing", "obstacles", v)} readOnly={readOnly} />
        </FieldSection>
      )}

      {categories.includes("hedging") && (
        <FieldSection title="✂️ Hedge Trimming Details" readOnly={readOnly}>
          <SelectField label="Number of Hedges" options={["1–2", "3–5", "6–10", "10+"]} value={value.hedging?.hedgeCount} onChange={(v) => update("hedging", "hedgeCount", v)} readOnly={readOnly} />
          <SelectField label="Average Height" options={HEDGE_HEIGHTS} value={value.hedging?.averageHeight} onChange={(v) => update("hedging", "averageHeight", v)} readOnly={readOnly} />
          <SelectField label="Sides to Trim" options={["Front only", "Front and sides", "All sides", "Top and all sides"]} value={value.hedging?.sidesToTrim} onChange={(v) => update("hedging", "sidesToTrim", v)} readOnly={readOnly} />
          <CheckboxField label="Debris removal needed" checked={value.hedging?.debrisRemoval ?? false} onChange={(v) => update("hedging", "debrisRemoval", v)} readOnly={readOnly} />
        </FieldSection>
      )}

      {categories.includes("leaf_removal") && (
        <FieldSection title="🍂 Leaf Removal Details" readOnly={readOnly}>
          <SelectField label="Yard Size" options={YARD_SIZES} value={value.leaf_removal?.yardSize} onChange={(v) => update("leaf_removal", "yardSize", v)} readOnly={readOnly} />
          <SelectField label="Leaf Coverage" options={COVERAGE_LEVELS} value={value.leaf_removal?.coverage} onChange={(v) => update("leaf_removal", "coverage", v)} readOnly={readOnly} />
          <SelectField label="Preference" options={["Bag and remove", "Mulch in place", "Blow to curb", "No preference"]} value={value.leaf_removal?.preference} onChange={(v) => update("leaf_removal", "preference", v)} readOnly={readOnly} />
          <CheckboxField label="Include gutter cleaning" checked={value.leaf_removal?.gutterCleaning ?? false} onChange={(v) => update("leaf_removal", "gutterCleaning", v)} readOnly={readOnly} />
        </FieldSection>
      )}

      {categories.includes("snow_clearing") && (
        <FieldSection title="❄️ Snow Clearing Details" readOnly={readOnly}>
          <SelectField label="Area to Clear" options={["Driveway only", "Sidewalk only", "Driveway + sidewalk", "Full property"]} value={value.snow_clearing?.areaToClear} onChange={(v) => update("snow_clearing", "areaToClear", v)} readOnly={readOnly} />
          <SelectField label="Snow Depth" options={SNOW_DEPTHS} value={value.snow_clearing?.snowDepth} onChange={(v) => update("snow_clearing", "snowDepth", v)} readOnly={readOnly} />
          <SelectField label="Surface Type" options={["Concrete", "Asphalt", "Gravel", "Mixed"]} value={value.snow_clearing?.surfaceType} onChange={(v) => update("snow_clearing", "surfaceType", v)} readOnly={readOnly} />
          <CheckboxField label="Salt/sand treatment needed" checked={value.snow_clearing?.saltTreatment ?? false} onChange={(v) => update("snow_clearing", "saltTreatment", v)} readOnly={readOnly} />
        </FieldSection>
      )}

      {categories.includes("general") && (
        <FieldSection title="🔧 General Yard Work Details" readOnly={readOnly}>
          <TextAreaField label="Specific Tasks" placeholder="Describe what needs to be done..." value={value.general?.specificTasks} onChange={(v) => update("general", "specificTasks", v)} readOnly={readOnly} />
          <SelectField label="Estimated Area" options={["Small (under 500 sq ft)", "Medium (500–2,000 sq ft)", "Large (2,000+ sq ft)"]} value={value.general?.estimatedArea} onChange={(v) => update("general", "estimatedArea", v)} readOnly={readOnly} />
          <SelectField label="Equipment" options={["Customer provides", "Vendor brings own", "Either is fine"]} value={value.general?.equipmentNeeded} onChange={(v) => update("general", "equipmentNeeded", v)} readOnly={readOnly} />
        </FieldSection>
      )}
    </div>
  );
}

/** Read-only display of job details for the detail page */
export function CategoryDetailsDisplay({ categories, detailsJson }: { categories: string[]; detailsJson: string | null | undefined }) {
  if (!detailsJson) return null;

  let details: JobDetails;
  try { details = JSON.parse(detailsJson); } catch { return null; }

  const hasAnyData = Object.values(details).some((section) =>
    section && Object.values(section).some((v) => v !== undefined && v !== "" && v !== false)
  );
  if (!hasAnyData) return null;

  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Job Specifications</h2>
      <div className="mt-2">
        <CategoryDetailsFields categories={categories} value={details} onChange={() => {}} readOnly />
      </div>
    </div>
  );
}

// ─── Helper components ───

function FieldSection({ title, readOnly, children }: { title: string; readOnly: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-lg border p-4 ${readOnly ? "border-gray-100 bg-gray-50" : "border-gray-200"}`}>
      <p className="text-sm font-semibold text-gray-700 mb-3">{title}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {children}
      </div>
    </div>
  );
}

function SelectField({ label, options, value, onChange, readOnly }: { label: string; options: string[]; value?: string; onChange: (v: string) => void; readOnly: boolean }) {
  if (readOnly) {
    if (!value) return null;
    return (
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-800">{value}</p>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600">{label}</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        <option value="">Select...</option>
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}

function CheckboxField({ label, checked, onChange, readOnly }: { label: string; checked: boolean; onChange: (v: boolean) => void; readOnly: boolean }) {
  if (readOnly) {
    if (!checked) return null;
    return (
      <div className="col-span-full">
        <p className="text-sm text-gray-800">✓ {label}</p>
      </div>
    );
  }

  return (
    <label className="col-span-full flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

function TextAreaField({ label, placeholder, value, onChange, readOnly }: { label: string; placeholder?: string; value?: string; onChange: (v: string) => void; readOnly: boolean }) {
  if (readOnly) {
    if (!value) return null;
    return (
      <div className="col-span-full">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{value}</p>
      </div>
    );
  }

  return (
    <div className="col-span-full">
      <label className="block text-xs font-medium text-gray-600">{label}</label>
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        maxLength={1000}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}
