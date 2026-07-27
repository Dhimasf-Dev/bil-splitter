"use client";

import React from "react";
import { Person } from "@/lib/types";
import { UserPlus, UserMinus, Users, Trash2, Edit2 } from "lucide-react";

interface PeopleManagerProps {
  people: Person[];
  setPeople: React.Dispatch<React.SetStateAction<Person[]>>;
}

const PRESET_COLORS = [
  "#10B981", // Emerald
  "#3B82F6", // Blue
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#8B5CF6", // Purple
  "#06B6D4", // Cyan
  "#F97316", // Orange
  "#84CC16", // Lime
];

export function PeopleManager({ people, setPeople }: PeopleManagerProps) {
  const addPerson = () => {
    const newId = `person-${Date.now()}`;
    const nextColor = PRESET_COLORS[people.length % PRESET_COLORS.length];
    const newPerson: Person = {
      id: newId,
      name: `Person ${people.length + 1}`,
      color: nextColor,
    };
    setPeople([...people, newPerson]);
  };

  const removePerson = (id: string) => {
    if (people.length <= 1) return;
    setPeople(people.filter((p) => p.id !== id));
  };

  const updateName = (id: string, name: string) => {
    setPeople(
      people.map((p) => (p.id === id ? { ...p, name: name || "Anonymous" } : p))
    );
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 backdrop-blur-xl rounded-2xl p-6 shadow-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Group Members ({people.length})
            </h2>
            <p className="text-xs text-slate-400">
              Add people joining the bill split
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => removePerson(people[people.length - 1]?.id)}
            disabled={people.length <= 1}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            title="Remove person"
          >
            <UserMinus className="w-4 h-4" />
          </button>

          <button
            onClick={addPerson}
            className="h-10 px-4 flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-all active:scale-95 shadow-lg shadow-emerald-900/30"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Person</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {people.map((person, index) => (
          <div
            key={person.id}
            className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 focus-within:border-emerald-500/50 transition-all"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-slate-950 shrink-0 shadow-md"
              style={{ backgroundColor: person.color }}
            >
              {person.name.substring(0, 2).toUpperCase()}
            </div>

            <div className="flex-1 relative">
              <input
                type="text"
                value={person.name}
                onChange={(e) => updateName(person.id, e.target.value)}
                placeholder={`Person ${index + 1}`}
                className="w-full bg-transparent text-slate-100 font-medium text-sm focus:outline-none placeholder-slate-500 pr-6"
              />
              <Edit2 className="w-3.5 h-3.5 text-slate-500 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {people.length > 1 && (
              <button
                onClick={() => removePerson(person.id)}
                className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
