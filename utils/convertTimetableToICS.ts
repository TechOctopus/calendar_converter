interface Teacher {
  fullName: string;
  id: string;
  shortName: string;
}

interface RoomStructured {
  name: string;
  id: string;
}

interface BaseLesson {
  isConsultation: string;
  room: string;
  roomStructured: RoomStructured;
  studyId: string;
  endTime: string;
  facultyCode: string;
  id: string;
  startTime: string;
  isDefaultCampus: string;
  courseId: string;
  courseName: string;
  campus: string;
  isSeminar: string;
  teachers: Teacher[];
  courseCode: string;
}

interface PeriodicLesson extends BaseLesson {
  dayOfWeek: string;
  week: string;
  typeName?: string;
  note?: string;
  periodicity: number;
  periodId: string;
}

interface BlockLesson extends BaseLesson {
  date: string;
  typeName?: string;
  periodId: string;
}

interface TimetableData {
  modificationDate: string;
  blockLessons: BlockLesson[];
  periodicLessons: PeriodicLesson[];
  daysOff: any[];
}

enum EventColor {
  LECTURE = "5", // Green for "prednáška"
  SEMINAR = "9", // Red for "cvičenie"
  DEFAULT = "0", // Default color
}

class ICalendar {
  private events: string[] = [];

  private formatDate(date: Date): string {
    return date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  }

  private escapeText(text: string): string {
    return text
      .replace(/[,;\\]/g, (match) => "\\" + match)
      .replace(/\n/g, "\\n");
  }

  private getEventColor(typeName: string): string {
    switch (typeName.toLowerCase()) {
      case "prednáška":
        return EventColor.LECTURE;
      case "cvičenie":
        return EventColor.SEMINAR;
      default:
        return EventColor.DEFAULT;
    }
  }

  private createEvent(
    summary: string,
    startDate: Date,
    endDate: Date,
    location: string,
    description: string,
    typeName: string,
    rrule?: string
  ): string {
    const event = [
      "BEGIN:VEVENT",
      `DTSTART:${this.formatDate(startDate)}`,
      `DTEND:${this.formatDate(endDate)}`,
      `SUMMARY:${this.escapeText(summary)}`,
      `LOCATION:${this.escapeText(location)}`,
      `DESCRIPTION:${this.escapeText(description)}`,
      `COLOR:${this.getEventColor(typeName)}`,
      `X-APPLE-CALENDAR-COLOR:#${this.getAppleCalendarColor(typeName)}`,
      `X-GOOGLE-CALENDAR-COLOR:${this.getGoogleCalendarColor(typeName)}`,
      `CATEGORIES:${this.escapeText(typeName)}`,
      `X-MICROSOFT-CDO-BUSYSTATUS:BUSY`,
      `TRANSP:OPAQUE`,
    ];

    if (rrule) {
      event.push(`RRULE:${rrule}`);
    }

    event.push(`UID:${crypto.randomUUID()}@ais.calendar`);
    event.push("END:VEVENT");
    return event.join("\r\n");
  }

  private getAppleCalendarColor(typeName: string): string {
    switch (typeName.toLowerCase()) {
      case "prednáška":
        return "4CD964";
      case "cvičenie":
        return "FF2D55";
      default:
        return "007AFF";
    }
  }

  private getGoogleCalendarColor(typeName: string): string {
    switch (typeName.toLowerCase()) {
      case "prednáška":
        return "#10";
      case "cvičenie":
        return "#11";
      default:
        return "#9";
    }
  }

  public addEvent(
    summary: string,
    startDate: Date,
    endDate: Date,
    location: string,
    description: string,
    typeName: string,
    rrule?: string
  ): void {
    this.events.push(
      this.createEvent(
        summary,
        startDate,
        endDate,
        location,
        description,
        typeName,
        rrule
      )
    );
  }

  public toString(): string {
    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//AIS Calendar Converter//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      ...this.events,
      "END:VCALENDAR",
    ].join("\r\n");
  }
}

function createCalendarEvents(timetableData: TimetableData): string {
  const calendar = new ICalendar();
  const semesterStart = new Date(
    parseInt(timetableData.modificationDate.substring(0, 4)),
    parseInt(timetableData.modificationDate.substring(4, 6)) - 1,
    parseInt(timetableData.modificationDate.substring(6, 8))
  );

  // Handle periodic lessons
  for (const lesson of timetableData.periodicLessons) {
    const dayOfWeek = parseInt(lesson.dayOfWeek);
    const daysUntilFirst = (dayOfWeek - semesterStart.getDay() + 7) % 7;
    const firstOccurrence = new Date(semesterStart);
    firstOccurrence.setDate(firstOccurrence.getDate() + daysUntilFirst);

    // Create start and end times for the event
    const startDateTime = new Date(firstOccurrence);
    const [startHour, startMinute] = lesson.startTime.split(":").map(Number);
    if (!startHour) {
      continue;
    }
    startDateTime.setHours(startHour, startMinute, 0);

    const endDateTime = new Date(firstOccurrence);
    const [endHour, endMinute] = lesson.endTime.split(":").map(Number);
    if (!endHour) {
      continue;
    }
    endDateTime.setHours(endHour, endMinute, 0);

    // Create description
    const description = [
      `Course: ${lesson.courseName}`,
      `Type: ${lesson.typeName}`,
      `Teachers: ${lesson.teachers.map((t) => t.fullName).join(", ")}`,
      `Room: ${lesson.room}`,
      `Campus: ${lesson.campus}`,
      lesson.note ? `Note: ${lesson.note}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    // Create RRULE
    let rrule = `FREQ=WEEKLY;UNTIL=20250630T215959Z`;
    if (lesson.periodicity > 1 || lesson.week) {
      const interval = lesson.week ? 2 : lesson.periodicity;
      rrule += `;INTERVAL=${interval}`;
    }

    // Add event to calendar
    calendar.addEvent(
      lesson.courseName,
      startDateTime,
      endDateTime,
      `${lesson.room}, ${lesson.campus}`,
      description,
      lesson.typeName ?? "prednáška",
      rrule
    );
  }

  // Handle block lessons with the same pattern
  for (const lesson of timetableData.blockLessons) {
    const date = new Date(
      parseInt(lesson.date.substring(0, 4)),
      parseInt(lesson.date.substring(4, 6)) - 1,
      parseInt(lesson.date.substring(6, 8))
    );

    const startDateTime = new Date(date);
    const [startHour, startMinute] = lesson.startTime.split(":").map(Number);
    if (!startHour) {
      continue;
    }

    startDateTime.setHours(startHour, startMinute, 0);

    const endDateTime = new Date(date);
    const [endHour, endMinute] = lesson.endTime.split(":").map(Number);
    if (!endHour) {
      continue;
    }

    endDateTime.setHours(endHour, endMinute, 0);

    const description = [
      `Course: ${lesson.courseName}`,
      `Type: ${lesson.typeName}`,
      `Teachers: ${lesson.teachers.map((t) => t.fullName).join(", ")}`,
      `Room: ${lesson.room}`,
      `Campus: ${lesson.campus}`,
    ].join("\n");

    calendar.addEvent(
      lesson.courseName,
      startDateTime,
      endDateTime,
      `${lesson.room}, ${lesson.campus}`,
      description,
      lesson.typeName ?? "prednáška"
    );
  }

  return calendar.toString();
}

function downloadICSFile(
  icsContent: string,
  filename: string = "timetable.ics"
) {
  const blob = new Blob([icsContent], {
    type: "text/calendar;charset=utf-8",
  });
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function (timetableJson: string) {
  try {
    const timetableData = JSON.parse(timetableJson) as TimetableData;
    const icsContent = createCalendarEvents(timetableData);
    downloadICSFile(icsContent, "timetable_ls_2025.ics");
  } catch (error) {
    console.error("Error converting timetable:", error);
  }
}
