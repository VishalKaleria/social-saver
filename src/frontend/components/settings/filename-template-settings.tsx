

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Info, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { useDownload } from "@/context/download-context"
import { useGlobalContext } from "@/context/global-context"

// Fixed type definition - make all properties required
interface FilenameTemplate {
  enabled: boolean;
  template: string;
  sanitizeFilename: boolean;
  maxLength: number;
  dateFormat: string;
  handleDuplicates: boolean;
}

const formSchema = z.object({
  enabled: z.boolean(),
  template: z.string().min(1, "Template is required"),
  sanitizeFilename: z.boolean(),
  maxLength: z.number().max(255),
  dateFormat: z.string().min(1, "Date format is required"),
  handleDuplicates: z.boolean(),
})

const VARIABLES = [
  { name: "title", description: "Video title" },
  { name: "id", description: "Video ID" },
  { name: "uploader", description: "Channel/uploader name" },
  { name: "channel", description: "Channel name" },
  { name: "upload_date", description: "Upload date (formatted)" },
  { name: "timestamp", description: "Upload timestamp" },
  { name: "duration", description: "Duration in seconds" },
  { name: "view_count", description: "View count" },
  { name: "like_count", description: "Like count" },
  { name: "resolution", description: "Video resolution (height)" },
  { name: "ext", description: "File extension" },
  { name: "format_id", description: "Format ID" },
  { name: "quality", description: "Quality setting used" },
  { name: "type", description: "Media type (video, audio, etc.)" },
]

const DATE_FORMATS = [
  { format: "YYYY-MM-DD", example: "2023-04-15" },
  { format: "MM/DD/YYYY", example: "04/15/2023" },
  { format: "DD.MM.YYYY", example: "15.04.2023" },
  { format: "YYYY/MM/DD", example: "2023/04/15" },
  { format: "MMMM D, YYYY", example: "April 15, 2023" },
  { format: "D MMMM YYYY", example: "15 April 2023" },
]

export function FilenameTemplateSettings() {
  const { globalSettings: settings, updateGlobalSettings:updateSettings } = useGlobalContext()
  const [previewFilename, setPreviewFilename] = useState("Example Video [abc123].mp4")

  // Create default values ensuring all required properties are set
  const defaultFilenameTemplate: FilenameTemplate = settings.filenameTemplate

  // Use defaultFilenameTemplate combined with existing settings
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      enabled: settings.filenameTemplate?.enabled ?? defaultFilenameTemplate.enabled,
      template: settings.filenameTemplate?.template ?? defaultFilenameTemplate.template,
      sanitizeFilename: settings.filenameTemplate?.sanitizeFilename ?? defaultFilenameTemplate.sanitizeFilename,
      maxLength: settings.filenameTemplate?.maxLength ?? defaultFilenameTemplate.maxLength,
      dateFormat: settings.filenameTemplate?.dateFormat ?? defaultFilenameTemplate.dateFormat,
      handleDuplicates: settings.filenameTemplate?.handleDuplicates ?? defaultFilenameTemplate.handleDuplicates,
    },
  })

  // Update preview when form values change
  useEffect(() => {
    generatePreview(form.getValues() as FilenameTemplate);
  }, [form.watch()]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    // Update settings
    const newFilenameTemplate: FilenameTemplate = {
      enabled: values.enabled,
      template: values.template,
      sanitizeFilename: values.sanitizeFilename,
      maxLength: values.maxLength,
      dateFormat: values.dateFormat,
      handleDuplicates: values.handleDuplicates,
    }

    await updateSettings({
      filenameTemplate: newFilenameTemplate,
    })

    // Update preview
    generatePreview(newFilenameTemplate)
  }

  const formatDate = (dateStr: string, format: string) => {
    // Simple date formatter that handles basic date formats
    // TODO: use library like dayjs or date-fns
    const year = dateStr.substring(0, 4)
    const month = dateStr.substring(4, 6)
    const day = dateStr.substring(6, 8)
    
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ]
    
    // Replace tokens in the format string
    return format
      .replace("YYYY", year)
      .replace("MM", month)
      .replace("DD", day)
      .replace("MMMM", monthNames[parseInt(month, 10) - 1])
      .replace("D", parseInt(day, 10).toString())
  }

  const generatePreview = (template: FilenameTemplate) => {
    if (!template.enabled) {
      setPreviewFilename("Example Video.mp4")
      return
    }

    // Create a mock video metadata
    const rawDate = "20230415"
    const formattedDate = formatDate(rawDate, template.dateFormat)
    
    const mockData = {
      title: "Example Video",
      id: "abc123",
      uploader: "Example Channel",
      channel: "Example Channel",
      upload_date: formattedDate,
      timestamp: "1681516800",
      duration: "360",
      view_count: "12345",
      like_count: "1000",
      resolution: "1080",
      ext: "mp4",
      format_id: "22",
      quality: "high",
      type: "video",
    }

    // Replace variables in template
    let filename = template.template
    for (const [key, value] of Object.entries(mockData)) {
      filename = filename.replace(new RegExp(`\\$\\{${key}\\}`, "g"), value)
    }

    // Add extension if not present
    if (!filename.endsWith(".mp4")) {
      filename += ".mp4"
    }

    // Sanitize if needed
    if (template.sanitizeFilename) {
      filename = filename.replace(/[/\\?%*:|"<>]/g, "_")
    }

    // Truncate if needed
    if (template.maxLength > 0 && filename.length > template.maxLength) {
      const ext = ".mp4"
      const base = filename.substring(0, filename.length - ext.length)
      filename = base.substring(0, template.maxLength - ext.length) + ext
    }

    // Show duplicate handling if enabled
    if (template.handleDuplicates) {
      filename = filename.replace(/\.mp4$/, " (1).mp4")
    }

    setPreviewFilename(filename)
  }

  const insertVariable = (variable: string) => {
    const currentTemplate = form.getValues("template")
    const cursorPosition =
      document.activeElement instanceof HTMLInputElement
        ? document.activeElement.selectionStart || currentTemplate.length
        : currentTemplate.length

    const newTemplate =
      currentTemplate.substring(0, cursorPosition) + `\${${variable}}` + currentTemplate.substring(cursorPosition)

    form.setValue("template", newTemplate)
  }

  return (
    <Form {...form}>
      <Card>
        <CardHeader>
          <CardTitle>Filename Template</CardTitle>
          <CardDescription>Configure how filenames are generated for downloads</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={form.control}
            name="enabled"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Use Custom Filename Template</FormLabel>
                  <FormDescription>Generate filenames based on video metadata</FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked)
                      generatePreview({
                        ...form.getValues(),
                        enabled: checked,
                      } as FilenameTemplate)
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {form.watch("enabled") && (
            <>
              <FormField
                control={form.control}
                name="template"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-center">
                      <FormLabel>Filename Template</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Info className="h-4 w-4 mr-2" />
                            Variables
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                          <div className="space-y-2">
                            <h4 className="font-medium">Available Variables</h4>
                            <p className="text-sm text-muted-foreground">
                              Click a variable to insert it into the template
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {VARIABLES.map((variable) => (
                                <Badge
                                  key={variable.name}
                                  variant="outline"
                                  className="cursor-pointer hover:bg-accent"
                                  onClick={() => insertVariable(variable.name)}
                                >
                                  {variable.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <FormControl>
                      <Input {...field} placeholder="${title} [${id}]" />
                    </FormControl>
                    <FormDescription>
                      Use variables like ${"{title}"} or ${"{id}"} to create dynamic filenames
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sanitizeFilename"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Sanitize Filenames</FormLabel>
                      <FormDescription>Remove invalid characters from filenames</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked)
                          generatePreview({
                            ...form.getValues(),
                            sanitizeFilename: checked,
                          } as FilenameTemplate)
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="handleDuplicates"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Handle Duplicate Filenames</FormLabel>
                      <FormDescription>Add a number to filenames that already exist</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked)
                          generatePreview({
                            ...form.getValues(),
                            handleDuplicates: checked,
                          } as FilenameTemplate)
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxLength"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum Filename Length: {field.value} characters</FormLabel>
                    <FormControl>
                      <Slider
                        min={0}
                        max={255}
                        step={5}
                        value={[field.value]}
                        onValueChange={(value) => {
                          field.onChange(value[0])
                          generatePreview({
                            ...form.getValues(),
                            maxLength: value[0],
                          } as FilenameTemplate)
                        }}
                      />
                    </FormControl>
                    <FormDescription>Limit the length of generated filenames (0 = no limit)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dateFormat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date Format</FormLabel>
                    <div className="grid grid-cols-3 gap-2">
                      {DATE_FORMATS.map((format) => (
                        <Button
                          key={format.format}
                          type="button"
                          variant={field.value === format.format ? "default" : "outline"}
                          className="h-auto py-2 px-3 justify-start"
                          onClick={() => {
                            field.onChange(format.format)
                            generatePreview({
                              ...form.getValues(),
                              dateFormat: format.format,
                            } as FilenameTemplate)
                          }}
                        >
                          <div className="text-left">
                            <div className="text-sm font-medium">{format.format}</div>
                            <div className="text-xs text-muted-foreground">{format.example}</div>
                          </div>
                        </Button>
                      ))}
                    </div>
                    <FormDescription>Format for dates in filenames</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          <div className="mt-4 p-4 border rounded-lg">
            <div className="text-sm font-medium mb-2">Preview:</div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-mono bg-muted p-2 rounded flex-1 overflow-hidden text-ellipsis">
                {previewFilename}
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => generatePreview(form.getValues() as FilenameTemplate)}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button 
            type="button" 
            onClick={form.handleSubmit(onSubmit)}
          >
            Save Changes
          </Button>
        </CardFooter>
      </Card>
    </Form>
  )
}