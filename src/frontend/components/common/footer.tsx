import { appConfig } from "@/lib/app-config"
import { Button } from "@/components/ui/button"
import { ElectronLink } from "@/components/electron-hyperlink"

export default function Footer() {
  

  return (
       <footer className="text-center border-t pt-6 mt-8">
        <p className="text-sm text-muted-foreground">
          Social Saver is an independent project created with ❤️ by{" "}
          {appConfig.author}
        </p>
        <div className="flex justify-center gap-4 mt-3">
          <Button
            variant="link"
            size="sm"
            className="text-muted-foreground"
            asChild
          >
            <ElectronLink href={appConfig.links.privacy}>Privacy Policy</ElectronLink>
          </Button>
          <Button
            variant="link"
            size="sm"
            className="text-muted-foreground"
            asChild
          >
            <ElectronLink href={appConfig.links.terms}>Terms of Use</ElectronLink>
          </Button>
          <Button
            variant="link"
            size="sm"
            className="text-muted-foreground"
            asChild
          >
            <ElectronLink href={appConfig.links.documentation}>Documentation</ElectronLink>
          </Button>
        </div>
      </footer>
  )
}

